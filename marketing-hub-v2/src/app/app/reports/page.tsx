import { ReportsClient } from "@/components/reports/ReportsClient";
import { getFieldOptionsMap } from "@/lib/data/data-admin";
import { listReports } from "@/lib/data/repos";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const [reports, fieldOptions] = await Promise.all([
    listReports(),
    getFieldOptionsMap("reports"),
  ]);
  return <ReportsClient initial={reports} fieldOptions={fieldOptions} />;
}
