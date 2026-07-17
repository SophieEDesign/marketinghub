import { AppShell } from "@/components/shell/AppShell";
import { getSessionUser } from "@/lib/auth/session";
import { DEMO_STAFF, isAuthBypass } from "@/lib/auth/config";
import { redirect } from "next/navigation";

export default async function StaffAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = (await getSessionUser()) ?? (isAuthBypass() ? DEMO_STAFF : null);
  if (!user) {
    redirect("/login?next=/app");
  }

  return <AppShell userName={user.full_name}>{children}</AppShell>;
}
