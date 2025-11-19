"use client";

import { useState, useEffect } from "react";
import { Field } from "@/lib/fields";
import LinkedRecordChip from "./LinkedRecordChip";
import LinkedRecordPicker from "./LinkedRecordPicker";
import { fetchLinkedRecord } from "@/lib/linkedRecords";

interface LinkedRecordFieldProps {
  field: Field;
  value: string | null;
  onChange: (value: string | null) => void;
  editable?: boolean;
}

export default function LinkedRecordField({
  field,
  value,
  onChange,
  editable = true,
}: LinkedRecordFieldProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [linkedRecord, setLinkedRecord] = useState<{
    id: string;
    displayValue: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const toTable = field.options?.to_table;
  const displayField = field.options?.display_field || "name";

  // Fetch linked record when value changes
  useEffect(() => {
    if (value && toTable) {
      setLoading(true);
      fetchLinkedRecord(toTable, value, displayField).then((result) => {
        if (result) {
          setLinkedRecord({
            id: result.id,
            displayValue: result.displayValue,
          });
        } else {
          setLinkedRecord(null);
        }
        setLoading(false);
      });
    } else {
      setLinkedRecord(null);
    }
  }, [value, toTable, displayField]);

  if (!toTable) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400">
        Linked record field not configured (missing to_table)
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {linkedRecord && (
        <LinkedRecordChip
          displayValue={linkedRecord.displayValue}
          onRemove={editable ? () => onChange(null) : undefined}
          onClick={editable ? () => setShowPicker(true) : undefined}
        />
      )}

      {!linkedRecord && !loading && (
        <button
          type="button"
          onClick={() => setShowPicker(true)}
          className="btn-secondary text-sm w-fit"
          disabled={!editable}
        >
          {value ? "Change" : "Select"} {field.label}
        </button>
      )}

      {loading && (
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Loading...
        </div>
      )}

      {showPicker && (
        <LinkedRecordPicker
          table={toTable}
          displayField={displayField}
          value={value}
          onChange={(newId) => {
            onChange(newId);
            setShowPicker(false);
          }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}

