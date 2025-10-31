"use client";

import Image from "next/image";
import { useState } from "react";

export default function LoginPage() {
  const [u, setU] = useState("NCCI");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    const res = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ u, p }),
    });
    setLoading(false);
    if (res.ok) {
      window.location.href = "/dashboard";
    } else {
      setErr("Invalid credentials");
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-gray-50 px-4 py-12">
      <form
        onSubmit={submit}
        className="w-full max-w-md space-y-6 rounded-2xl bg-white p-10 shadow-lg"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <Image
            src="/images/datanest_logo.png"
            alt="DataNest"
            width={360}
            height={110}
            className="h-20 w-auto md:h-24"
            priority
          />
          <span className="text-2xl font-semibold tracking-wide text-gray-900">
            DataNest Login
          </span>
        </div>
        {err ? <p className="text-sm text-red-600">{err}</p> : null}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Username
          </label>
          <input
            className="input"
            value={u}
            onChange={(event) => setU(event.target.value)}
            autoComplete="username"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <input
            type="password"
            className="input"
            value={p}
            onChange={(event) => setP(event.target.value)}
            autoComplete="current-password"
          />
        </div>
        <button className="btn w-full" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}

