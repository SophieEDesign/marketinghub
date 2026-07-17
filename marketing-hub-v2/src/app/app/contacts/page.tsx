import { ContactsClient } from "@/components/contacts/ContactsClient";
import { listContacts } from "@/lib/data/repos";

export default async function ContactsPage() {
  return <ContactsClient initial={await listContacts()} />;
}
