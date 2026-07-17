"use client";

import { useEffect, useState } from "react";
import { contactOwnerOptions } from "@/lib/data/collections";
import type { Contact } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ContactOwnerSelect({
  value,
  onChange,
  className,
  id,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  className?: string;
  id?: string;
  disabled?: boolean;
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
    <select
      id={id}
      className={cn("field", className)}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{loaded ? "Select contact…" : "Loading…"}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
