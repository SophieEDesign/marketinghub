import { EnquiriesClient } from "@/components/enquiries/EnquiriesClient";
import { listWebEnquiries } from "@/lib/data/web-enquiries";
import { hasServiceRoleKey } from "@/lib/supabase/admin";

export default async function EnquiriesPage() {
  const configured = hasServiceRoleKey();
  let initial: Awaited<ReturnType<typeof listWebEnquiries>> = [];
  if (configured) {
    try {
      initial = await listWebEnquiries({ includeTest: false });
    } catch {
      initial = [];
    }
  }

  return <EnquiriesClient initial={initial} configured={configured} />;
}
