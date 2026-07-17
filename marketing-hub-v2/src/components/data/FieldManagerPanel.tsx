"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Settings2, Trash2, X } from "lucide-react";
import {
  MANAGEABLE_FIELD_TYPES,
  type FieldDef,
  type FieldOption,
  type FieldType,
} from "@/lib/data/collections";
import { cn } from "@/lib/utils";

const TYPE_LABELS: Record<FieldType, string> = {
  text: "Text",
  longtext: "Long text",
  number: "Number",
  date: "Date",
  datetime: "Date & time",
  url: "URL",
  email: "Email",
  select: "Single select",
  tags: "Multi-select / tags",
  readonly: "Read-only",
};

type Draft = {
  key: string;
  label: string;
  type: FieldType;
  options: FieldOption[];
  /** Empty string = new field */
  originalKey: string | null;
};

function blankDraft(): Draft {
  return {
    key: "",
    label: "",
    type: "text",
    options: [],
    originalKey: null,
  };
}

function draftFromField(field: FieldDef): Draft {
  return {
    key: field.key,
    label: field.label,
    type: field.type,
    options: (field.options ?? []).map((o) => ({ ...o })),
    originalKey: field.key,
  };
}

function OptionsEditor({
  options,
  onChange,
  disabled,
}: {
  options: FieldOption[];
  onChange: (next: FieldOption[]) => void;
  disabled?: boolean;
}) {
  function updateAt(index: number, patch: Partial<FieldOption>) {
    onChange(
      options.map((opt, i) => (i === index ? { ...opt, ...patch } : opt))
    );
  }

  function removeAt(index: number) {
    onChange(options.filter((_, i) => i !== index));
  }

  function addOption() {
    onChange([...options, { value: "", label: "" }]);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="label mb-0">Options</label>
        <button
          type="button"
          className="btn-ghost text-xs"
          disabled={disabled}
          onClick={addOption}
        >
          <Plus className="h-3.5 w-3.5" />
          Add option
        </button>
      </div>
      {options.length === 0 ? (
        <p className="text-xs text-muted">No options yet — add choices for this field.</p>
      ) : (
        <ul className="space-y-2">
          {options.map((opt, index) => (
            <li key={index} className="flex items-center gap-2">
              <input
                className="field flex-1"
                placeholder="Label"
                value={opt.label}
                disabled={disabled}
                onChange={(e) => {
                  const label = e.target.value;
                  updateAt(index, {
                    label,
                    value:
                      !opt.value || opt.value === opt.label
                        ? label
                        : opt.value,
                  });
                }}
              />
              <input
                className="field w-28"
                placeholder="Value"
                value={opt.value}
                disabled={disabled}
                title="Stored value"
                onChange={(e) => updateAt(index, { value: e.target.value })}
              />
              <button
                type="button"
                className="rounded p-1.5 text-muted hover:bg-sand hover:text-red-600"
                disabled={disabled}
                title="Remove option"
                onClick={() => removeAt(index)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function FieldManagerPanel({
  open,
  fields,
  collectionLabel,
  busy,
  error,
  initialKey,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  fields: FieldDef[];
  collectionLabel: string;
  busy?: boolean;
  error?: string | null;
  /** Prefill editor with this field when opening. */
  initialKey?: string | null;
  onClose: () => void;
  onSave: (payload: {
    mode: "create" | "update";
    key: string;
    label: string;
    type: FieldType;
    options?: FieldOption[];
    newKey?: string;
  }) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
}) {
  const [selectedKey, setSelectedKey] = useState<string | "new">("new");
  const [draft, setDraft] = useState<Draft>(blankDraft());

  const selectedField = useMemo(
    () =>
      selectedKey === "new"
        ? null
        : fields.find((f) => f.key === selectedKey) ?? null,
    [fields, selectedKey]
  );

  // Sync selection when the panel opens or a column gear targets a field.
  useEffect(() => {
    if (!open) return;
    if (initialKey) {
      const field = fields.find((f) => f.key === initialKey);
      if (field) {
        setSelectedKey(field.key);
        setDraft(draftFromField(field));
        return;
      }
    }
    setSelectedKey("new");
    setDraft(blankDraft());
    // Intentionally omit `fields` — avoid resetting while typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialKey]);

  if (!open) return null;

  const locked = Boolean(selectedField?.locked);
  const optionsLocked = Boolean(selectedField?.optionsSource);
  const needsOptions = draft.type === "select" || draft.type === "tags";
  const canRenameKey = Boolean(selectedField?.custom) && !locked;
  const isCreate = selectedKey === "new";

  function selectField(key: string | "new") {
    setSelectedKey(key);
    if (key === "new") {
      setDraft(blankDraft());
      return;
    }
    const field = fields.find((f) => f.key === key);
    if (field) setDraft(draftFromField(field));
  }

  async function handleSave() {
    const label = draft.label.trim() || draft.key.trim();
    const keySource = isCreate ? draft.label || draft.key : draft.key;
    const key = keySource.trim();
    if (!key && isCreate) return;
    if (!label) return;

    const options = needsOptions
      ? draft.options
          .map((o) => ({
            value: (o.value || o.label).trim(),
            label: (o.label || o.value).trim(),
          }))
          .filter((o) => o.value)
      : undefined;

    if (isCreate) {
      await onSave({
        mode: "create",
        key,
        label,
        type: draft.type,
        options,
      });
      return;
    }

    await onSave({
      mode: "update",
      key: draft.originalKey || draft.key,
      label,
      type: draft.type,
      options,
      newKey:
        canRenameKey && draft.key.trim() !== draft.originalKey
          ? draft.key.trim()
          : undefined,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/20 md:left-sidebar">
      <button
        type="button"
        className="absolute inset-0 -z-10 cursor-default"
        aria-label="Close field manager"
        onClick={onClose}
      />
      <aside className="flex h-full w-full max-w-md flex-col border-l border-border bg-white shadow-soft">
        <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-4">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
              <Settings2 className="h-3.5 w-3.5" />
              Field manager
            </p>
            <h2 className="font-display text-xl text-brand">{collectionLabel}</h2>
            <p className="mt-0.5 text-sm text-muted">
              Set field names, types, and dropdown options.
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-muted hover:bg-sand hover:text-foreground"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {error ? (
          <p className="mx-4 mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}

        <div className="grid min-h-0 flex-1 grid-rows-[auto_1fr] gap-0 md:grid-cols-[140px_minmax(0,1fr)] md:grid-rows-1">
          <nav className="max-h-40 overflow-y-auto border-b border-border p-2 md:max-h-none md:border-b-0 md:border-r">
            <button
              type="button"
              onClick={() => selectField("new")}
              className={cn(
                "mb-1 flex w-full items-center gap-1.5 rounded-lg px-2 py-2 text-left text-sm",
                selectedKey === "new"
                  ? "bg-accent-soft font-medium text-brand"
                  : "text-muted hover:bg-sand hover:text-foreground"
              )}
            >
              <Plus className="h-3.5 w-3.5" />
              New field
            </button>
            {fields.map((field) => (
              <button
                key={field.key}
                type="button"
                onClick={() => selectField(field.key)}
                className={cn(
                  "mb-0.5 w-full rounded-lg px-2 py-1.5 text-left text-sm",
                  selectedKey === field.key
                    ? "bg-accent-soft font-medium text-brand"
                    : "text-muted hover:bg-sand hover:text-foreground"
                )}
              >
                <span className="block truncate">{field.label}</span>
                <span className="block truncate text-[10px] uppercase opacity-70">
                  {field.type}
                  {field.custom ? " · custom" : ""}
                  {field.locked ? " · locked" : ""}
                </span>
              </button>
            ))}
          </nav>

          <div className="min-h-0 overflow-y-auto p-4">
            <div className="space-y-4">
              <div>
                <label className="label">Display name</label>
                <input
                  className="field"
                  value={draft.label}
                  disabled={locked || busy}
                  placeholder="e.g. Priority"
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      label: e.target.value,
                      key:
                        isCreate || !d.key
                          ? e.target.value
                          : d.key,
                    }))
                  }
                />
              </div>

              {(isCreate || canRenameKey) && (
                <div>
                  <label className="label">
                    Field key {isCreate ? "(auto from name)" : ""}
                  </label>
                  <input
                    className="field font-mono text-sm"
                    value={draft.key}
                    disabled={locked || busy || (!isCreate && !canRenameKey)}
                    placeholder="e.g. priority"
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, key: e.target.value }))
                    }
                  />
                  {!isCreate ? (
                    <p className="mt-1 text-xs text-muted">
                      Renaming updates the key on all rows.
                    </p>
                  ) : null}
                </div>
              )}

              {!isCreate && !canRenameKey ? (
                <div>
                  <label className="label">Field key</label>
                  <input
                    className="field font-mono text-sm"
                    value={draft.key}
                    disabled
                  />
                  <p className="mt-1 text-xs text-muted">
                    Core field keys cannot be renamed.
                  </p>
                </div>
              ) : null}

              <div>
                <label className="label">Type</label>
                <select
                  className="field"
                  value={draft.type}
                  disabled={locked || busy}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      type: e.target.value as FieldType,
                    }))
                  }
                >
                  {(locked
                    ? [draft.type]
                    : MANAGEABLE_FIELD_TYPES
                  ).map((type) => (
                    <option key={type} value={type}>
                      {TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>

              {needsOptions ? (
                optionsLocked ? (
                  <p className="rounded-xl border border-border bg-sand/60 px-3 py-2 text-xs text-muted">
                    Options are loaded dynamically from{" "}
                    {selectedField?.optionsSource === "themes"
                      ? "Themes"
                      : "Contacts"}
                    .
                  </p>
                ) : (
                  <OptionsEditor
                    options={draft.options}
                    disabled={locked || busy}
                    onChange={(options) =>
                      setDraft((d) => ({ ...d, options }))
                    }
                  />
                )
              ) : null}

              {locked ? (
                <p className="text-xs text-muted">
                  This system field is locked and cannot be changed.
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3">
          <div>
            {!isCreate && selectedField && !selectedField.locked ? (
              <button
                type="button"
                className="btn-ghost text-[var(--danger)]"
                disabled={busy}
                onClick={() => void onDelete(selectedField.key)}
              >
                <Trash2 className="h-4 w-4" />
                Delete field
              </button>
            ) : null}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={
                busy ||
                locked ||
                !(draft.label.trim() || draft.key.trim())
              }
              onClick={() => void handleSave()}
            >
              {busy
                ? "Saving…"
                : isCreate
                  ? "Create field"
                  : "Save field"}
            </button>
          </div>
        </footer>
      </aside>
    </div>
  );
}
