import { PartnersHub } from "@/components/partners/PartnersHub";
import { listSponsorships } from "@/lib/data/repos";
import { hasSupabaseConfig } from "@/lib/auth/config";

export default async function PartnersPage() {
  return (
    <PartnersHub
      initial={await listSponsorships()}
      supabaseReady={hasSupabaseConfig()}
    />
  );
}
