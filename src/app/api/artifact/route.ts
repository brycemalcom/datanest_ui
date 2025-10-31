import { NextRequest, NextResponse } from "next/server";

const BASE = process.env.DATANEST_BASE_URL || "https://api.datanestai.net";
const KEY = process.env.DATANEST_API_KEY;

export async function GET(req: NextRequest) {
  if (!KEY) {
    return NextResponse.json({ detail: "missing_api_key" }, { status: 500 });
  }

  const urlParam = req.nextUrl.searchParams.get("url") || "";
  const fullUrl = urlParam.startsWith("/v1/")
    ? `${BASE}${urlParam}`
    : urlParam.startsWith("http")
    ? urlParam
    : "";

  if (!fullUrl) {
    return NextResponse.json(
      { detail: "invalid_artifact_url" },
      { status: 400 }
    );
  }

  try {
    const resp = await fetch(fullUrl, {
      headers: { "x-api-key": KEY },
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return new NextResponse(text || resp.statusText, { status: resp.status });
    }

    const headers = new Headers(resp.headers);
    if (!headers.has("content-disposition")) {
      headers.set("content-disposition", "attachment");
    }

    return new NextResponse(resp.body, {
      status: 200,
      headers,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    console.error("proxy /api/artifact error:", err?.message || err);
    return NextResponse.json({ detail: "proxy_error" }, { status: 502 });
  }
}

