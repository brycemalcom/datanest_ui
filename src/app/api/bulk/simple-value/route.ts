import { NextRequest, NextResponse } from "next/server";
import { parse } from "csv-parse/sync";

type AddressRow = {
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  apn?: string;
  fips?: string;
};

type SimpleValueData = {
  estimated_value?: number | null;
  price_range_min?: number | null;
  price_range_max?: number | null;
  confidence_score?: number | null;
  fsd_score?: number | null;
  qvm_value_range_code?: string | null;
  qvm_asof_date?: string | null;
  last_sale_date?: string | null;
  full_address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  apn?: string | null;
  fips?: string | null;
  request_id?: string | null;
};

type SimpleValueResponse = {
  data?: SimpleValueData | null;
  artifacts?: {
    pdf_url?: string | null;
  } | null;
};

const BASE_URL = process.env.DATANEST_BASE_URL || "https://api.datanestai.net";
const API_KEY = process.env.DATANEST_API_KEY;

const OUTPUT_HEADERS = [
  "input_address",
  "input_city",
  "input_state",
  "input_zip",
  "input_apn",
  "input_fips",
  "match_status",
  "estimated_value",
  "price_range_min",
  "price_range_max",
  "confidence_score",
  "fsd_score",
  "qvm_value_range_code",
  "qvm_asof_date",
  "last_sale_date",
  "full_address",
  "city",
  "state",
  "zip",
  "apn",
  "fips",
  "request_id",
  "pdf_url",
] as const;

const DEMO_LIMIT = 10_000;
const REQUEST_TIMEOUT = 55_000;

function normalizeHeader(header: string | null | undefined) {
  if (!header) return "";
  const normalized = header.replace(/^\ufeff/, "").trim().toLowerCase();

  if (
    ["address", "address1", "street", "street_address"].includes(
      normalized
    )
  ) {
    return "address";
  }
  if (["city", "city_name"].includes(normalized)) {
    return "city";
  }
  if (["state", "state_code", "st"].includes(normalized)) {
    return "state";
  }
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

function toCsvValue(value: unknown) {
  if (value === null || value === undefined) return "";
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function buildCsv(rows: Record<(typeof OUTPUT_HEADERS)[number], unknown>[]) {
  const headerRow = OUTPUT_HEADERS.join(",");
  const dataRows = rows.map((row) =>
    OUTPUT_HEADERS.map((key) => toCsvValue(row[key])).join(",")
  );
  return [headerRow, ...dataRows].join("\n");
}

function buildPayload(row: AddressRow) {
  const hasAddress = row.address && row.city && row.state;
  const hasApn = row.apn && row.fips;

  if (hasAddress) {
    return {
      address: row.address,
      city: row.city,
      state: row.state,
      zip: row.zip,
    };
  }

  if (hasApn) {
    return {
      apn: row.apn,
      fips: row.fips,
    };
  }

  return null;
}

async function processRow(
  row: AddressRow,
  index: number
): Promise<Record<(typeof OUTPUT_HEADERS)[number], unknown>> {
  if (!API_KEY) {
    throw new Error("missing_api_key");
  }

  const payload = buildPayload(row);

  if (!payload) {
    console.log("bulk row", index, "invalid_selector");
    return {
      input_address: row.address ?? "",
      input_city: row.city ?? "",
      input_state: row.state ?? "",
      input_zip: row.zip ?? "",
      input_apn: row.apn ?? "",
      input_fips: row.fips ?? "",
      match_status: "error:invalid_selector",
      estimated_value: "",
      price_range_min: "",
      price_range_max: "",
      confidence_score: "",
      fsd_score: "",
      qvm_value_range_code: "",
      qvm_asof_date: "",
      last_sale_date: "",
      full_address: "",
      city: "",
      state: "",
      zip: "",
      apn: "",
      fips: "",
      request_id: "",
      pdf_url: "",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const resp = await fetch(`${BASE_URL}/v1/report/simple-value`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const text = await resp.text();
    console.log("bulk row", index, resp.status);

    let json: SimpleValueResponse | null = null;
    try {
      json = text ? (JSON.parse(text) as SimpleValueResponse) : null;
    } catch (error) {
      console.error("bulk row", index, "json parse error", error);
    }

    const data = json?.data ?? null;
    const artifacts = json?.artifacts ?? null;

    const matchStatus =
      resp.status === 200
        ? "matched"
        : resp.status === 404
        ? "no_match"
        : `error:${resp.status}`;

    return {
      input_address: row.address ?? "",
      input_city: row.city ?? "",
      input_state: row.state ?? "",
      input_zip: row.zip ?? "",
      input_apn: row.apn ?? "",
      input_fips: row.fips ?? "",
      match_status: matchStatus,
      estimated_value: data?.estimated_value ?? "",
      price_range_min: data?.price_range_min ?? "",
      price_range_max: data?.price_range_max ?? "",
      confidence_score: data?.confidence_score ?? "",
      fsd_score: data?.fsd_score ?? "",
      qvm_value_range_code: data?.qvm_value_range_code ?? "",
      qvm_asof_date: data?.qvm_asof_date ?? "",
      last_sale_date: data?.last_sale_date ?? "",
      full_address: data?.full_address ?? "",
      city: data?.city ?? "",
      state: data?.state ?? "",
      zip: data?.zip ?? "",
      apn: data?.apn ?? "",
      fips: data?.fips ?? "",
      request_id: data?.request_id ?? "",
      pdf_url: artifacts?.pdf_url ?? "",
    };
  } catch (error) {
    console.error("bulk row", index, "error", error);
    const isTimeout =
      error instanceof DOMException && error.name === "AbortError";

    return {
      input_address: row.address ?? "",
      input_city: row.city ?? "",
      input_state: row.state ?? "",
      input_zip: row.zip ?? "",
      input_apn: row.apn ?? "",
      input_fips: row.fips ?? "",
      match_status: isTimeout ? "error:timeout" : "error:unknown",
      estimated_value: "",
      price_range_min: "",
      price_range_max: "",
      confidence_score: "",
      fsd_score: "",
      qvm_value_range_code: "",
      qvm_asof_date: "",
      last_sale_date: "",
      full_address: "",
      city: "",
      state: "",
      zip: "",
      apn: "",
      fips: "",
      request_id: "",
      pdf_url: "",
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function parseCsv(file: File): Promise<AddressRow[]> {
  const text = await file.text();
  if (!text.trim()) return [];

  const records = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as AddressRow[];

  return records.map((record) => {
    const normalized: AddressRow = {};

    for (const [key, value] of Object.entries(record)) {
      const normalizedKey = normalizeHeader(key);
      const strValue = typeof value === "string" ? value.trim() : String(value);

      if (normalizedKey === "address") normalized.address = strValue;
      if (normalizedKey === "city") normalized.city = strValue;
      if (normalizedKey === "state") normalized.state = strValue;
      if (normalizedKey === "zip") normalized.zip = strValue;
      if (normalizedKey === "apn") normalized.apn = strValue;
      if (normalizedKey === "fips") normalized.fips = strValue;
    }

    return normalized;
  });
}

export async function POST(req: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json({ detail: "missing_api_key" }, { status: 500 });
  }

  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ detail: "file_required" }, { status: 400 });
  }

  const rows = await parseCsv(file);

  if (!rows.length) {
    return NextResponse.json({ detail: "empty_csv" }, { status: 400 });
  }

  if (rows.length > DEMO_LIMIT) {
    return NextResponse.json(
      { detail: "Demo limit is 25 rows. Please upload a smaller file." },
      { status: 400 }
    );
  }

  const results: Record<(typeof OUTPUT_HEADERS)[number], unknown>[] = [];

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const processed = await processRow(row, i + 1);
    results.push(processed);
  }

  const csv = buildCsv(results);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition":
        'attachment; filename="datanest_simple_value_results.csv"',
    },
  });
}

