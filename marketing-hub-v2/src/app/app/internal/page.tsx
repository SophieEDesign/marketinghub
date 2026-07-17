import { InternalHub } from "@/components/internal/InternalHub";
import { listMerchOrders, listStaffRequests } from "@/lib/data/repos";

export default async function InternalPage() {
  const [merch, requests] = await Promise.all([
    listMerchOrders(),
    listStaffRequests(),
  ]);
  return <InternalHub merch={merch} requests={requests} />;
}
