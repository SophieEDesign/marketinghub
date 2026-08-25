import type { Contact } from "@/lib/types";

export async function createPersonContact(name: string): Promise<Contact> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Enter a name");
  }
  const res = await fetch("/api/contacts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: trimmed, kind: "person" }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    item?: Contact;
    error?: string;
  };
  if (!res.ok || !data.item) {
    throw new Error(
      typeof data.error === "string" && data.error.trim()
        ? data.error
        : "Could not add this person"
    );
  }
  return data.item;
}
