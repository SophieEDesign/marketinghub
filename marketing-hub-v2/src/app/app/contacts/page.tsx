import { ContactsClient } from "@/components/contacts/ContactsClient";
import { ImportFromSupabaseButton } from "@/components/supabase/ImportFromSupabaseButton";
import { listContacts } from "@/lib/data/repos";

export default async function ContactsPage() {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ImportFromSupabaseButton label="Refresh from Contact table" />
      </div>
      <ContactsClient initial={await listContacts()} />
    </div>
  );
}
