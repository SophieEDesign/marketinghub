import { InternalHub } from "@/components/internal/InternalHub";
import { allowDemoAuth, DEMO_STAFF } from "@/lib/auth/config";
import { getSessionUser } from "@/lib/auth/session";
import {
  listMerchInventory,
  listMerchOrders,
  listStaffRequests,
} from "@/lib/data/repos";
import {
  filterMerchOrdersForUser,
  isMerchAdmin,
} from "@/lib/merch/access";

export default async function InternalPage() {
  const user =
    (await getSessionUser()) ?? (allowDemoAuth() ? DEMO_STAFF : null);
  const [allMerch, inventory, requests] = await Promise.all([
    listMerchOrders(),
    listMerchInventory(),
    listStaffRequests(),
  ]);
  const merch = user
    ? filterMerchOrdersForUser(allMerch, user)
    : [];
  const canManageAll = user ? isMerchAdmin(user) : false;

  return (
    <InternalHub
      merch={merch}
      inventory={inventory}
      requests={requests}
      canManageAll={canManageAll}
      viewerName={user?.full_name ?? ""}
    />
  );
}
