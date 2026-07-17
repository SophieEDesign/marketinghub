import { ReportsClient } from "@/components/reports/ReportsClient";
import { listReports } from "@/lib/data/repos";

export default async function ReportsPage() {
  return <ReportsClient initial={await listReports()} />;
}
