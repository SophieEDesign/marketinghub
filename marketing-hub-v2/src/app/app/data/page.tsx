import { redirect } from "next/navigation";

/** Data tables live under Admin — keep this path as a redirect. */
export default function DataAdminPage() {
  redirect("/app/admin/data");
}
