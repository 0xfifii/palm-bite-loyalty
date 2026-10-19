import { redirect } from "next/navigation";
import { getSession, homeFor } from "@/lib/auth";
import { Welcome } from "@/components/welcome/Welcome";

export default async function Page() {
  const { user, profile } = await getSession();
  if (user && profile?.status === "active") redirect(homeFor(profile.role));
  return <Welcome />;
}
