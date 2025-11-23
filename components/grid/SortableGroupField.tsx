"use client";

import { Field } from "@/lib/fields";

interface SortableGroupFieldProps {
  field: Field;
  children: React.ReactNode;
}

export default function SortableGroupField({
  field,
  children,
}: SortableGroupFieldProps) {
  return <>{children}</>;
}

