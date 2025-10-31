import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function Home() {
  const cookieStore = await cookies();
  const authed = cookieStore.get("dn_sess")?.value === "ok";
  redirect(authed ? "/dashboard" : "/login");
}
