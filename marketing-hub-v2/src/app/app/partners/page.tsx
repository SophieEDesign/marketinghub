import { PartnersHub } from "@/components/partners/PartnersHub";
import { getSessionUser } from "@/lib/auth/session";
import { listSponsorships } from "@/lib/data/repos";

export default async function PartnersPage() {
  const [user, sponsorships] = await Promise.all([
    getSessionUser(),
    listSponsorships(),
  ]);
  const initial =
    user?.role === "admin"
      ? sponsorships
      : sponsorships.map((s) => ({ ...s, value: "" }));
  return <PartnersHub initial={initial} currentUserId={user?.id ?? null} />;
}
