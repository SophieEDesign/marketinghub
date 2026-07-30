import { ReportsClient } from "@/components/reports/ReportsClient";
import { getFieldOptionsMap } from "@/lib/data/data-admin";
import { listPaidCampaigns, listReports } from "@/lib/data/repos";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const [reports, paidCampaigns, fieldOptions, paidFieldOptions] =
    await Promise.all([
      listReports(),
      listPaidCampaigns(),
      getFieldOptionsMap("reports"),
      getFieldOptionsMap("paid_campaigns"),
    ]);
  return (
    <ReportsClient
      initial={reports}
      paidCampaigns={paidCampaigns}
      fieldOptions={fieldOptions}
      paidFieldOptions={paidFieldOptions}
    />
  );
}
