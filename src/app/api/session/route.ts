import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { u, p } = await req.json();
  const ok =
    u === process.env.DEMO_USERNAME && p === process.env.DEMO_PASSWORD;

  if (!ok) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("dn_sess", "ok", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
  });
  return res;
}

