"use client";

import Image from "next/image";
import Link from "next/link";
import React from "react";
import Papa from "papaparse";
import { saveAs } from "file-saver";

import { sidebarItems } from "@/components/sidebar-items";

type SimpleValueResponse = {
  estimated_value?: unknown;
  price_range_min?: unknown;
  price_range_max?: unknown;
  price_range?: {
    min?: unknown;
    max?: unknown;
    [key: string]: unknown;
  } | null;
  artifacts?: {
    pdf_url?: string | null;
    [key: string]: unknown;
  } | null;
  data?: Record<string, unknown> | null;
  detail?: unknown;
  [key: string]: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeHeader(value: string | null | undefined) {
  if (!value) return "";
  const normalized = value.replace(/^\ufeff/, "").trim().toLowerCase();
  if (
    ["address", "address1", "street", "street_address"].includes(
      normalized
    )
  ) {
    return "address";
  }
  if (["city", "city_name"].includes(normalized)) return "city";
  if (["state", "state_code", "st"].includes(normalized)) return "state";
  if (
    ["zip", "zip_code", "zipcode", "postal_code", "zip5"].includes(
      normalized
    )
  ) {
    return "zip";
  }
  if (["apn", "parcel", "parcel_number"].includes(normalized)) {
    return "apn";
  }
  if (["fips", "fips_code"].includes(normalized)) {
    return "fips";
  }
  return normalized;
}

function formatCurrency(value: number | null) {
  if (value == null) return null;
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function detailValue(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" || typeof value === "string") return value;
  return String(value);
}

export default function DashboardPage() {
  const [address, setAddress] = React.useState("2920 S UNION AVE");
  const [city, setCity] = React.useState("CHICAGO");
  const [stateInput, setStateInput] = React.useState("IL");
  const [zip, setZip] = React.useState("60616");

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [raw, setRaw] = React.useState<SimpleValueResponse | null>(null);
  const [csvLoading, setCsvLoading] = React.useState(false);
  const [csvNotice, setCsvNotice] = React.useState<
    { message: string; tone: "error" | "success" | "info" } | null
  >(null);
  const [showJson, setShowJson] = React.useState(true);

  const simpleData = React.useMemo(() => {
    return isRecord(raw?.data) ? (raw?.data as Record<string, unknown>) : null;
  }, [raw]);

  const estimatedValue = React.useMemo(() => {
    if (!simpleData) return null;
    return toNumber(simpleData["estimated_value"]);
  }, [simpleData]);

  const rangeMin = React.useMemo(() => {
    if (!simpleData) return null;
    return toNumber(simpleData["price_range_min"]);
  }, [simpleData]);

  const rangeMax = React.useMemo(() => {
    if (!simpleData) return null;
    return toNumber(simpleData["price_range_max"]);
  }, [simpleData]);

  const confidenceScore = React.useMemo(() => {
    if (!simpleData) return null;
    return toNumber(simpleData["confidence_score"]);
  }, [simpleData]);

  const beds = React.useMemo(() => detailValue(simpleData?.beds), [simpleData]);
  const baths = React.useMemo(
    () => detailValue(simpleData?.baths),
    [simpleData]
  );
  const yearBuilt = React.useMemo(
    () => detailValue(simpleData?.year_built),
    [simpleData]
  );
  const gla = React.useMemo(() => detailValue(simpleData?.gla), [simpleData]);

  const pdfHref = React.useMemo(() => {
    const fromData = isRecord(simpleData?.artifacts)
      ? (simpleData?.artifacts as Record<string, unknown>).pdf_url
      : undefined;
    const fromRoot = isRecord(raw?.artifacts)
      ? (raw?.artifacts as Record<string, unknown>).pdf_url
      : undefined;
    const pdfUrl = typeof fromData === "string" ? fromData : fromRoot;
    if (typeof pdfUrl !== "string" || pdfUrl.length === 0) return null;
    return `/api/artifact?url=${encodeURIComponent(pdfUrl)}`;
  }, [raw, simpleData]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setRaw(null);

    try {
      const res = await fetch("/api/report/simple-value", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          city,
          state: stateInput,
          zip,
        }),
      });

      const json = (await res.json()) as SimpleValueResponse;
      if (!res.ok) {
        const detailMessage =
          (isRecord(json) && typeof json.detail === "string"
            ? json.detail
            : undefined) ?? `Request failed (${res.status})`;
        setError(detailMessage);
      } else {
        setRaw(json);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError(
          "This is taking longer than usual—still working. Try again in a moment."
        );
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Network error");
      }
    } finally {
      setLoading(false);
    }
  }

  async function onCsv(event: React.ChangeEvent<HTMLInputElement>) {
    const inputEl = event.target;
    const file = inputEl.files?.[0];
    if (!file) return;

    setCsvNotice(null);
    setCsvLoading(true);
    try {
      const text = await file.text();
      if (!text.trim()) {
        setCsvNotice({
          message: "CSV appears to be empty.",
          tone: "error",
        });
        return;
      }

      const parsed = Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
      });

      const rawHeaders = parsed.meta.fields ?? [];
      const headers = rawHeaders
        .map((field) => normalizeHeader(field))
        .filter(Boolean);

      if (!headers.length) {
        setCsvNotice({
          message:
            "CSV is missing headers. Expected address/city/state/zip or apn/fips.",
          tone: "error",
        });
        return;
      }

      const hasAddressHeaders = ["address", "city", "state", "zip"].every((h) =>
        headers.includes(h)
      );
      const hasApnHeaders = ["apn", "fips"].every((h) => headers.includes(h));

      if (!hasAddressHeaders && !hasApnHeaders) {
        setCsvNotice({
          message:
            "CSV must include address/city/state/zip or apn/fips headers.",
          tone: "error",
        });
        return;
      }

      const formData = new FormData();
      formData.append("file", file, file.name);

      const response = await fetch("/api/bulk/simple-value", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let detail = `Bulk request failed (${response.status})`;
        try {
          const errorData = await response.json();
          if (typeof errorData?.detail === "string") {
            detail = errorData.detail;
          }
        } catch (parseError) {
          console.error("bulk upload response parse error", parseError);
        }
        setCsvNotice({ message: detail, tone: "error" });
        return;
      }

      const blob = await response.blob();
      saveAs(blob, "datanest_simple_value_results.csv");
      setCsvNotice({ message: "Bulk results downloaded.", tone: "success" });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Bulk upload failed";
      setCsvNotice({ message, tone: "error" });
    } finally {
      setCsvLoading(false);
      inputEl.value = "";
    }
  }

  const formattedEstimate = formatCurrency(estimatedValue);
  const minFormatted = formatCurrency(rangeMin);
  const maxFormatted = formatCurrency(rangeMax);
  const formattedRange =
    minFormatted || maxFormatted
      ? `${minFormatted ?? "—"} – ${maxFormatted ?? "—"}`
      : null;

  return (
    <main className="flex min-h-screen bg-gray-100">
      <aside className="hidden w-64 flex-col border-r border-gray-200 bg-gradient-to-b from-white via-slate-50 to-slate-100 px-6 py-8 text-slate-800 md:flex">
        <div className="mb-10 flex items-center gap-3">
          <div>
            <Image
              src="/images/ncci_logo.png"
              alt="NCCI"
              width={168}
              height={44}
              className="h-10 w-auto rounded"
            />
            <div className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-500">
              DataNest AI
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 text-sm">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const isActive = "active" in item && Boolean(item.active);
            return (
              <button
                key={item.label}
                type="button"
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 transition ${
                  isActive
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-white hover:text-slate-900"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="mt-10 text-xs text-slate-400">
          NCCI internal demo • {new Date().getFullYear()}
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col bg-gray-50 pb-16">
        <header className="border-b bg-white">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3 md:hidden">
              <div>
                <Image
                  src="/images/ncci_logo.png"
                  alt="NCCI"
                  width={136}
                  height={36}
                  className="h-8 w-auto"
                />
                <div className="mt-1 text-xs uppercase tracking-[0.22em] text-gray-500">
                  DataNest AI
                </div>
              </div>
            </div>
            <Link
              className="text-sm font-medium text-blue-600 underline underline-offset-4"
              href="https://api.datanestai.net/docs#/"
              target="_blank"
              rel="noreferrer"
            >
              OpenAPI (JSON)
            </Link>
          </div>
        </header>

        <div className="mx-auto w-full max-w-6xl space-y-8 px-6 py-8">
          <section className="rounded-2xl bg-white p-6 shadow">
            <h2 className="mb-4 text-lg font-semibold">Address Lookup</h2>
            <form
              onSubmit={onSubmit}
              className="grid grid-cols-1 gap-4 md:grid-cols-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Address
                </label>
                <input
                  className="input"
                  placeholder="Address"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  City
                </label>
                <input
                  className="input"
                  placeholder="City"
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  State
                </label>
                <input
                  className="input"
                  placeholder="State"
                  value={stateInput}
                  onChange={(event) => setStateInput(event.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Zip
                </label>
                <input
                  className="input"
                  placeholder="Zip"
                  value={zip}
                  onChange={(event) => setZip(event.target.value)}
                  required
                />
              </div>
              <div className="md:col-span-4">
                <button className="btn" disabled={loading}>
                  {loading ? "Looking up…" : "Get Value"}
                </button>
              </div>
            </form>

            {error ? (
              <p className="mt-3 text-sm text-red-600">{error}</p>
            ) : null}

            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <div className="rounded-xl bg-gray-100 p-6">
                <div className="mb-2 text-sm text-gray-500">Quick Value</div>
                <div className="text-3xl font-semibold">
                  {formattedEstimate ?? (raw ? "No value found" : "—")}
                </div>
                <div className="mt-3 space-y-1 text-sm text-gray-600">
                  {formattedRange ? (
                    <div>
                      <span className="font-medium text-gray-700">Range:</span>{" "}
                      {formattedRange}
                    </div>
                  ) : null}
                  {typeof confidenceScore === "number" && !Number.isNaN(confidenceScore) ? (
                    <div>
                      <span className="font-medium text-gray-700">Confidence:</span>{" "}
                      {confidenceScore}
                    </div>
                  ) : null}
                  {beds != null ? (
                    <div>
                      <span className="font-medium text-gray-700">Beds:</span>{" "}
                      {beds}
                    </div>
                  ) : null}
                  {baths != null ? (
                    <div>
                      <span className="font-medium text-gray-700">Baths:</span>{" "}
                      {baths}
                    </div>
                  ) : null}
                  {yearBuilt != null ? (
                    <div>
                      <span className="font-medium text-gray-700">Year Built:</span>{" "}
                      {yearBuilt}
                    </div>
                  ) : null}
                  {gla != null ? (
                    <div>
                      <span className="font-medium text-gray-700">GLA:</span>{" "}
                      {gla}
                    </div>
                  ) : null}
                </div>
                {pdfHref ? (
                  <a
                    href={pdfHref}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex items-center text-sm font-medium text-blue-600 underline"
                  >
                    Download PDF
                  </a>
                ) : null}
              </div>

              <div className="rounded-xl bg-gray-900 p-4 text-gray-100 md:col-span-2">
                <div className="mb-2 flex items-center justify-between text-sm text-gray-400">
                  <span>Raw JSON</span>
                  <button
                    type="button"
                    className="underline"
                    onClick={() => setShowJson((prev) => !prev)}
                  >
                    {showJson ? "Hide" : "Show"}
                  </button>
                </div>
                {showJson ? (
                  <pre className="max-h-72 overflow-auto whitespace-pre-wrap text-xs">
                    {raw
                      ? JSON.stringify(raw, null, 2)
                      : "Run a lookup to see the response."}
                  </pre>
                ) : (
                  <p className="text-xs text-gray-400">JSON hidden</p>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow">
            <h2 className="mb-2 text-lg font-semibold">CSV Batch</h2>
            <p className="mb-4 text-sm text-gray-600">
              Upload CSV with headers: <code>address,city,state,zip</code>.
            </p>
            <label className="inline-flex items-center gap-3 text-sm font-medium">
              <span className="btn cursor-pointer">
                {csvLoading ? "Processing…" : "Choose CSV"}
              </span>
              <input
                type="file"
                accept=".csv"
                onChange={onCsv}
                className="hidden"
                disabled={csvLoading}
              />
            </label>
            {csvNotice ? (
              <p
                className={`mt-3 text-sm ${
                  csvNotice.tone === "error"
                    ? "text-red-600"
                    : csvNotice.tone === "success"
                    ? "text-green-600"
                    : "text-gray-600"
                }`}
              >
                {csvNotice.message}
              </p>
            ) : null}
          </section>

          <section className="rounded-2xl bg-white p-6 shadow">
            <h2 className="mb-2 text-lg font-semibold">Developer</h2>
            <div className="space-y-2 text-sm">
              <div>
                <strong>API Base:</strong> https://api.datanestai.net
              </div>
              <div>
                <strong>Auth:</strong> header <code>x-api-key</code>
              </div>
              <pre className="overflow-auto rounded bg-gray-100 p-3 text-xs">
{`curl -i -H "x-api-key: <YOUR_KEY>" -H "Content-Type: application/json" \
-d '{"address":"2920 S UNION AVE","city":"CHICAGO","state":"IL","zip":"60616"}' \
https://api.datanestai.net/v1/property/lookup`}
              </pre>
            </div>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow">
            <h2 className="mb-3 text-lg font-semibold">Developer Resources</h2>
            <div className="space-y-6 text-sm text-gray-700">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Testing in Postman</h3>
                <ol className="mt-3 space-y-3 pl-5">
                  <li>
                    <span className="font-medium">Step 1:</span> Create a new Collection named <em>DataNest Simple Value API</em>.
                  </li>
                  <li>
                    <span className="font-medium">Step 2:</span> Add a GET request to <code className="font-mono">https://api.datanestai.net/v1/health</code>
                    <ul className="mt-2 space-y-2 pl-5 text-gray-600">
                      <li>
                        → set <code className="font-mono">x-api-key</code> header to your key (e.g. <code className="font-mono">55c82fe3a5440b76b65dd33ff83b613e9d8b8587381749cc1fceaffde4bd45c4</code>).
                      </li>
                      <li>
                        → click <span className="font-semibold">Send</span> to verify <code className="font-mono">{'{"ok":true}'}</code>.
                      </li>
                    </ul>
                  </li>
                  <li>
                    <span className="font-medium">Step 3:</span> Add a POST request to <code className="font-mono">https://api.datanestai.net/v1/report/simple-value</code>
                    <div className="mt-2 space-y-2 pl-5 text-gray-600">
                      <div>→ Body → raw JSON:</div>
                      <pre className="overflow-auto rounded bg-gray-100 p-3 text-xs text-gray-800">
{`{
  "address": "2920 S UNION AVE",
  "city": "CHICAGO",
  "state": "IL",
  "zip": "60616"
}`}
                      </pre>
                      <div>→ click <span className="font-semibold">Send</span> to receive the full valuation payload.</div>
                    </div>
                  </li>
                  <li>
                    <span className="font-medium">Step 4:</span> Copy the <code className="font-mono">artifacts.pdf_url</code> value and open it in a new tab (with header <code className="font-mono">x-api-key</code>) to download the generated PDF.
                  </li>
                </ol>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-900">Authentication</h3>
                <p>All endpoints require the <code className="font-mono">x-api-key</code> header.</p>
                <p>Rotate or revoke keys via the API Keys &amp; Access section (coming soon).</p>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-900">Base URLs</h3>
                <ul className="space-y-1 pl-5">
                  <li>Production: <code className="font-mono">https://api.datanestai.net</code></li>
                  <li>Sandbox (local dev): <code className="font-mono">http://127.0.0.1:8000</code></li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-900">Useful endpoints</h3>
                <ul className="space-y-1 pl-5">
                  <li>GET <code className="font-mono">/v1/health</code> — quick health check</li>
                  <li>POST <code className="font-mono">/v1/report/simple-value</code> — single property valuation</li>
                  <li>POST <code className="font-mono">/v1/report/simple-value/batch</code> — (coming soon) batch valuation CSV</li>
                  <li>GET <code className="font-mono">/v1/artifacts/{`{id}`}.pdf</code> — download generated PDF</li>
                </ul>
              </div>

              <Link
                href="https://api.datanestai.net/docs#/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center text-sm font-semibold text-blue-600 underline underline-offset-4"
              >
                View Full API Docs
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

