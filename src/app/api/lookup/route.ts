import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const base = process.env.DATANEST_BASE_URL || "https://api.datanestai.net";
  const key = process.env.DATANEST_API_KEY;
  if (!key) {
    return NextResponse.json({ detail: "missing_api_key" }, { status: 500 });
  }

  const payload = await req.json();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  const startedAt = Date.now();

  try {
    const upstream = await fetch(`${base}/v1/property/lookup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: controller.signal,
    });

    const text = await upstream.text();
    console.log(
      "property-lookup status:",
      upstream.status,
      "took",
      Date.now() - startedAt,
      "ms"
    );

    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        "Content-Type":
          upstream.headers.get("content-type") ?? "application/json",
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    console.error("proxy /api/lookup error:", err?.message || err);
    return NextResponse.json({ detail: "proxy_error" }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}

