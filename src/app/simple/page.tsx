"use client";

import React from "react";

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

function formatCurrency(value: number | null) {
  if (value == null) return null;
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export default function SimplePage() {
  const [form, setForm] = React.useState({
    address: "2920 S UNION AVE",
    city: "CHICAGO",
    state: "IL",
    zip: "60616",
  });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [raw, setRaw] = React.useState<SimpleValueResponse | null>(null);

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
        body: JSON.stringify(form),
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

  const estimated = formatCurrency(estimatedValue);
  const min = formatCurrency(rangeMin);
  const max = formatCurrency(rangeMax);

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold">Simple Value Lookup</h1>
          <p className="text-sm text-gray-600">
            Submit an address to call `/api/report/simple-value` via the Next.js
            proxy.
          </p>
        </header>

        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <input
            className="input md:col-span-2"
            placeholder="Address"
            value={form.address}
            onChange={(event) => setForm((f) => ({ ...f, address: event.target.value }))}
            required
          />
          <input
            className="input"
            placeholder="City"
            value={form.city}
            onChange={(event) => setForm((f) => ({ ...f, city: event.target.value }))}
            required
          />
          <input
            className="input"
            placeholder="State"
            value={form.state}
            maxLength={2}
            onChange={(event) => setForm((f) => ({ ...f, state: event.target.value }))}
            required
          />
          <input
            className="input"
            placeholder="Zip"
            value={form.zip}
            onChange={(event) => setForm((f) => ({ ...f, zip: event.target.value }))}
            required
          />
          <button className="btn md:col-span-4" disabled={loading}>
            {loading ? "Fetching…" : "Get Value"}
          </button>
        </form>

        {error ? <div className="text-sm text-red-600">{error}</div> : null}

        <section className="space-y-3 rounded-2xl bg-white p-5 shadow">
          <div className="text-sm text-gray-500">Quick Value</div>
          <div className="text-3xl font-semibold">
            {estimated ?? (raw ? "No value found" : "—")}
          </div>
          {min || max ? (
            <div className="text-sm text-gray-500">
              Range: {min ?? "—"} – {max ?? "—"}
            </div>
          ) : null}
          {typeof confidenceScore === "number" && !Number.isNaN(confidenceScore) ? (
            <div className="text-sm text-gray-500">
              Confidence: {confidenceScore}
            </div>
          ) : null}
          {pdfHref ? (
            <a
              href={pdfHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center text-sm font-medium text-blue-600 underline"
            >
              Download PDF
            </a>
          ) : null}
        </section>

        <section className="rounded-2xl bg-gray-900 p-5 text-gray-100">
          <div className="mb-2 text-sm text-gray-400">Raw JSON</div>
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap text-xs">
            {raw ? JSON.stringify(raw, null, 2) : "Run a lookup to see the response."}
          </pre>
        </section>
      </div>
    </main>
  );
}

