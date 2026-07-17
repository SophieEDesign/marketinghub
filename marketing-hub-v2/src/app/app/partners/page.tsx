import { PartnersHub } from "@/components/partners/PartnersHub";
import { listSponsorships } from "@/lib/data/repos";

export default async function PartnersPage() {
  return <PartnersHub initial={await listSponsorships()} />;
}
