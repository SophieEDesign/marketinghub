import type { Contact } from "@/lib/types";

export const MERCH_FOR_OTHER = "__other__";

/** Resolve display name + optional ownership when allocating via a contact. */
export function resolveMerchRequestedFor(input: {
  requested_for?: string | null;
  requested_for_contact_id?: string | null;
  contact: Contact | null;
  fallbackName: string;
}): {
  requested_for: string;
  requested_for_contact_id: string | null;
  /** Linked hub user id when the contact is linked; otherwise null (caller decides ownership). */
  allocated_user_id: string | null;
} {
  if (input.contact) {
    return {
      requested_for: input.contact.name.trim() || input.fallbackName,
      requested_for_contact_id: input.contact.id,
      allocated_user_id: input.contact.user_id,
    };
  }
  const name = (input.requested_for ?? "").trim() || input.fallbackName;
  return {
    requested_for: name,
    requested_for_contact_id: null,
    allocated_user_id: null,
  };
}

export function contactMerchForOptions(
  contacts: Contact[],
  currentContactId?: string | null,
  currentName?: string
): { value: string; label: string }[] {
  const options = contacts
    .filter((c) => (c.kind ?? "person") !== "company")
    .map((c) => {
      const name = c.name.trim();
      if (!name) return null;
      const org = c.organisation.trim();
      const hub = c.user_id ? " · Hub member" : "";
      const orgBit = !c.user_id && org ? ` · ${org}` : "";
      return {
        value: c.id,
        label: `${name}${hub || orgBit}`,
      };
    })
    .filter((o): o is { value: string; label: string } => Boolean(o))
    .sort((a, b) => a.label.localeCompare(b.label));

  options.push({
    value: MERCH_FOR_OTHER,
    label: "Other (type a name)",
  });

  if (
    currentContactId &&
    !options.some((o) => o.value === currentContactId)
  ) {
    options.unshift({
      value: currentContactId,
      label: `${(currentName ?? "Unknown").trim() || "Unknown"} (missing contact)`,
    });
  }

  return options;
}
