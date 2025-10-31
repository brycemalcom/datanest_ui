import { NextRequest, NextResponse } from "next/server";

const BASE = process.env.DATANEST_BASE_URL || "https://api.datanestai.net";
const KEY = process.env.DATANEST_API_KEY;

export async function POST(req: NextRequest) {
  if (!KEY) {
    return NextResponse.json({ detail: "missing_api_key" }, { status: 500 });
  }

  const body = await req.json();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 65_000);

  try {
    const resp = await fetch(`${BASE}/v1/report/simple-value`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": KEY,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await resp.text();
    if (!resp.ok) {
      return new NextResponse(text || resp.statusText, { status: resp.status });
    }
    return new NextResponse(text, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    const detail =
      err?.name === "AbortError"
        ? "proxy_timeout"
        : err?.message || "proxy_error";
    return NextResponse.json({ detail }, { status: 504 });
  } finally {
    clearTimeout(timeout);
  }
}

