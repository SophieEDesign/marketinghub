import { redirect } from "next/navigation";
import { LoginsClient } from "@/components/logins/LoginsClient";
import { getFieldOptionsMap } from "@/lib/data/data-admin";
import { listPlatformCredentials } from "@/lib/data/repos";
import { getSessionUser } from "@/lib/auth/session";
import { allowDemoAuth, DEMO_STAFF } from "@/lib/auth/config";

export const dynamic = "force-dynamic";

export default async function LoginsPage() {
  const user = (await getSessionUser()) ?? (allowDemoAuth() ? DEMO_STAFF : null);
  if (!user || user.role !== "admin") {
    redirect("/app");
  }

  const [logins, fieldOptions] = await Promise.all([
    listPlatformCredentials(),
    getFieldOptionsMap("platform_credentials"),
  ]);

  return <LoginsClient initial={logins} fieldOptions={fieldOptions} />;
}
