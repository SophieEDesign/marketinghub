"use client";

import { useEffect, useState } from "react";
import { contactOwnerOptions } from "@/lib/data/collections";
import type { Contact } from "@/lib/types";
import { SearchSelect } from "@/components/ui/SearchSelect";

export function ContactOwnerSelect({
  value,
  onChange,
  className,
  id,
  disabled,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (next: string) => void;
  className?: string;
  id?: string;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/contacts");
        if (!res.ok) return;
        const data = (await res.json()) as { contacts?: Contact[] };
        if (!cancelled) setContacts(data.contacts ?? []);
      } catch {
        /* keep empty list */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const options = contactOwnerOptions(contacts, value);

  return (
    <SearchSelect
      id={id}
      className={className}
      value={value}
      disabled={disabled || !loaded}
      aria-label={ariaLabel ?? "Owner"}
      allowEmpty
      emptyLabel={loaded ? "Assign person…" : "Loading…"}
      placeholder={loaded ? "Assign person…" : "Loading…"}
      options={options}
      onChange={onChange}
    />
  );
}
