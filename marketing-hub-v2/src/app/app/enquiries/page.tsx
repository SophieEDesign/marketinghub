import { EnquiriesClient } from "@/components/enquiries/EnquiriesClient";
import { listHubEnquiries } from "@/lib/data/hub-enquiries";
import { hasServiceRoleKey } from "@/lib/supabase/admin";

export default async function EnquiriesPage() {
  const configured = hasServiceRoleKey();
  let initial: Awaited<ReturnType<typeof listHubEnquiries>> = [];
  if (configured) {
    try {
      initial = await listHubEnquiries({ includeTest: false });
    } catch {
      initial = [];
    }
  }

  return <EnquiriesClient initial={initial} configured={configured} />;
}
