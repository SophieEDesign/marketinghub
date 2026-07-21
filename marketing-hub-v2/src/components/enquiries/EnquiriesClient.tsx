"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Download, Inbox } from "lucide-react";
import type { WebEnquiry, WebEnquiryStatus } from "@/lib/types";
import { computeEnquiryStats } from "@/lib/data/web-enquiries-stats";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar, matchesSearch } from "@/components/ui/FilterBar";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<WebEnquiryStatus, string> = {
  new: "New",
  in_progress: "In progress",
  done: "Done",
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  try {
    const d = parseISO(value.includes("T") ? value : value.replace(" ", "T"));
    if (Number.isNaN(d.getTime())) return value;
    return format(d, "dd MMM yyyy HH:mm");
  } catch {
    return value;
  }
}

function enquiryMessage(e: WebEnquiry): string {
  const raw = e.raw_payload;
  if (typeof raw.message === "string" && raw.message.trim()) {
    return raw.message.trim();
  }
  const make = e.make_fields;
  if (typeof make.message === "string") return make.message;
  return "";
}

function downloadCsv(rows: WebEnquiry[]) {
  const headers = [
    "submission_id",
    "created_at",
    "customer_name",
    "customer_email",
    "customer_phone",
    "customer_country",
    "final_service_category",
    "user_selected_service",
    "collection_location",
    "delivery_location",
    "selected_office",
    "office_email",
    "needs_manual_review",
    "marketing_emails_consent",
    "status",
    "is_test",
    "routing_reason",
  ];
  const escape = (v: string | boolean | null | undefined) => {
    const s = v == null ? "" : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      [
        r.submission_id,
        r.created_at ?? "",
        r.customer_name,
        r.customer_email,
        r.customer_phone,
        r.customer_country,
        r.final_service_category,
        r.user_selected_service,
        r.collection_location,
        r.delivery_location,
        r.selected_office,
        r.office_email,
        r.needs_manual_review,
        r.marketing_emails_consent,
        r.status,
        r.is_test,
        r.routing_reason,
      ]
        .map(escape)
        .join(",")
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `web-enquiries-${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function EnquiriesClient({
  initial,
  configured: initialConfigured,
}: {
  initial: WebEnquiry[];
  configured: boolean;
}) {
  const [items, setItems] = useState(initial);
  const [configured, setConfigured] = useState(initialConfigured);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [officeFilter, setOfficeFilter] = useState("all");
  const [showTest, setShowTest] = useState(false);
  const [selected, setSelected] = useState<WebEnquiry | null>(null);
  const [saving, setSaving] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  const refresh = useCallback(async () => {
    const qs = showTest ? "?include_test=1" : "";
    const res = await fetch(`/api/enquiries${qs}`);
    const data = await res.json();
    setItems(data.enquiries ?? []);
    setConfigured(data.configured !== false);
  }, [showTest]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!selected) return;
    const next = items.find((e) => e.id === selected.id) ?? null;
    setSelected(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync by id only
  }, [items, selected?.id]);

  const offices = useMemo(() => {
    const set = new Set(
      items.map((e) => e.selected_office).filter(Boolean)
    );
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((e) => {
      if (!showTest && e.is_test) return false;
      if (statusFilter !== "all" && e.status !== statusFilter) return false;
      if (officeFilter !== "all" && e.selected_office !== officeFilter) {
        return false;
      }
      return matchesSearch(search, [
        e.submission_id,
        e.customer_name,
        e.customer_email,
        e.customer_phone,
        e.customer_country,
        e.final_service_category,
        e.user_selected_service,
        e.collection_location,
        e.delivery_location,
        e.selected_office,
        e.routing_reason,
        enquiryMessage(e),
      ]);
    });
  }, [items, search, statusFilter, officeFilter, showTest]);

  const stats = useMemo(
    () => computeEnquiryStats(items, { includeTest: showTest }),
    [items, showTest]
  );

  async function setStatus(id: string, status: WebEnquiryStatus) {
    setSaving(true);
    try {
      await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", id, patch: { status } }),
      });
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this enquiry from the hub?")) return;
    setSaving(true);
    try {
      await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      setSelected(null);
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  function closeDrawer() {
    setSelected(null);
    setShowRaw(false);
  }

  return (
    <div>
      <PageHeader
        title="Web Enquiries"
        description="Quote form submissions from the website — received via WordPress webhook."
        actions={
          <button
            type="button"
            className="btn-secondary inline-flex items-center gap-2"
            onClick={() => downloadCsv(filtered)}
            disabled={filtered.length === 0}
          >
            <Download className="h-4 w-4" />
            Download CSV
          </button>
        }
      />

      {!configured ? (
        <div className="surface-card mb-6 border-amber-200 bg-amber-50/80 p-5 text-sm text-muted">
          <p className="font-medium text-foreground">Storage not configured</p>
          <p className="mt-1">
            Set{" "}
            <code className="text-xs">SUPABASE_SERVICE_ROLE_KEY</code> and run
            migration <code className="text-xs">018_web_enquiries</code>, then
            add <code className="text-xs">WEB_ENQUIRY_WEBHOOK_SECRET</code> for
            the WordPress primary webhook URL.
          </p>
        </div>
      ) : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "This week", value: stats.thisWeek },
          { label: "This month", value: stats.thisMonth },
          { label: "Total", value: stats.total },
          { label: "Needs review", value: stats.needsReview },
          { label: "New", value: stats.statusNew },
        ].map((kpi) => (
          <div key={kpi.label} className="surface-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {kpi.label}
            </p>
            <p className="mt-1 font-display text-2xl text-brand">{kpi.value}</p>
          </div>
        ))}
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search name, email, route, office…"
        resultCount={filtered.length}
        totalCount={items.filter((e) => showTest || !e.is_test).length}
        selects={[
          {
            id: "status",
            label: "Status",
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { value: "all", label: "All statuses" },
              { value: "new", label: "New" },
              { value: "in_progress", label: "In progress" },
              { value: "done", label: "Done" },
            ],
          },
          {
            id: "office",
            label: "Office",
            value: officeFilter,
            onChange: setOfficeFilter,
            options: [
              { value: "all", label: "All offices" },
              ...offices.map((o) => ({ value: o, label: o })),
            ],
          },
        ]}
      />

      <div className="mb-4 flex items-center gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            className="rounded border-border"
            checked={showTest}
            onChange={(e) => setShowTest(e.target.checked)}
          />
          Show test / staging rows
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className="surface-card flex flex-col items-center gap-3 px-6 py-16 text-center">
          <Inbox className="h-8 w-8 text-muted" />
          <p className="text-sm font-medium text-foreground">No enquiries yet</p>
          <p className="max-w-md text-sm text-muted">
            When the Quote Builder primary webhook points at this hub, new form
            submissions will appear here.
          </p>
        </div>
      ) : (
        <div className="surface-card overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border bg-sand/40 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Service</th>
                <th className="px-4 py-3 font-medium">Route</th>
                <th className="px-4 py-3 font-medium">Office</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((e) => (
                <tr
                  key={e.id}
                  className={cn(
                    "cursor-pointer transition hover:bg-sand/50",
                    selected?.id === e.id && "bg-accent-soft/40"
                  )}
                  onClick={() => {
                    setSelected(e);
                    setShowRaw(false);
                  }}
                >
                  <td className="whitespace-nowrap px-4 py-3 text-muted">
                    {formatDate(e.created_at ?? e.received_at)}
                    {e.is_test ? (
                      <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-amber-800">
                        Test
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">
                      {e.customer_name || "—"}
                    </p>
                    <p className="text-xs text-muted">{e.customer_email}</p>
                  </td>
                  <td className="px-4 py-3 capitalize text-muted">
                    {(e.final_service_category || e.user_selected_service || "—")
                      .replace(/_/g, " ")}
                    {e.needs_manual_review ? (
                      <span className="mt-1 block text-[10px] font-medium uppercase text-[var(--danger)]">
                        Review
                      </span>
                    ) : null}
                  </td>
                  <td className="max-w-[180px] truncate px-4 py-3 text-muted">
                    {[e.collection_location, e.delivery_location]
                      .filter(Boolean)
                      .join(" → ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {e.selected_office || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        e.status === "new" && "bg-accent-soft text-brand",
                        e.status === "in_progress" &&
                          "bg-amber-100 text-amber-900",
                        e.status === "done" && "bg-sand text-muted"
                      )}
                    >
                      {STATUS_LABELS[e.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected ? (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/25 md:left-sidebar"
            onClick={closeDrawer}
            aria-hidden
          />
          <aside
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-border bg-white shadow-soft"
            role="dialog"
            aria-modal="true"
            aria-label="Enquiry details"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-brand">
                  {selected.customer_name || "Enquiry"}
                </h2>
                <p className="text-xs text-muted">{selected.submission_id}</p>
              </div>
              <button
                type="button"
                className="btn-ghost px-2.5 py-1.5 text-xs"
                onClick={closeDrawer}
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="label !mb-0.5">Status</dt>
                  <dd>
                    <select
                      className="field"
                      value={selected.status}
                      disabled={saving}
                      onChange={(ev) =>
                        void setStatus(
                          selected.id,
                          ev.target.value as WebEnquiryStatus
                        )
                      }
                    >
                      {(Object.keys(STATUS_LABELS) as WebEnquiryStatus[]).map(
                        (s) => (
                          <option key={s} value={s}>
                            {STATUS_LABELS[s]}
                          </option>
                        )
                      )}
                    </select>
                  </dd>
                </div>
                <div>
                  <dt className="label !mb-0.5">Submitted</dt>
                  <dd>
                    {formatDate(selected.created_at ?? selected.received_at)}
                  </dd>
                </div>
                <div>
                  <dt className="label !mb-0.5">Email</dt>
                  <dd>
                    {selected.customer_email ? (
                      <a
                        className="text-brand underline-offset-2 hover:underline"
                        href={`mailto:${selected.customer_email}`}
                      >
                        {selected.customer_email}
                      </a>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="label !mb-0.5">Phone</dt>
                  <dd>{selected.customer_phone || "—"}</dd>
                </div>
                <div>
                  <dt className="label !mb-0.5">Country</dt>
                  <dd>{selected.customer_country || "—"}</dd>
                </div>
                <div>
                  <dt className="label !mb-0.5">Service</dt>
                  <dd className="capitalize">
                    {(
                      selected.final_service_category ||
                      selected.user_selected_service ||
                      "—"
                    ).replace(/_/g, " ")}
                  </dd>
                </div>
                <div>
                  <dt className="label !mb-0.5">From → To</dt>
                  <dd>
                    {[selected.collection_location, selected.delivery_location]
                      .filter(Boolean)
                      .join(" → ") || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="label !mb-0.5">Office</dt>
                  <dd>
                    {selected.selected_office || "—"}
                    {selected.office_email ? (
                      <span className="block text-xs text-muted">
                        {selected.office_email}
                      </span>
                    ) : null}
                  </dd>
                </div>
                {selected.routing_reason ? (
                  <div>
                    <dt className="label !mb-0.5">Routing</dt>
                    <dd className="text-muted">{selected.routing_reason}</dd>
                  </div>
                ) : null}
                {enquiryMessage(selected) ? (
                  <div>
                    <dt className="label !mb-0.5">Message</dt>
                    <dd className="whitespace-pre-wrap text-muted">
                      {enquiryMessage(selected)}
                    </dd>
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2 text-xs">
                  {selected.needs_manual_review ? (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 font-medium text-[var(--danger)]">
                      Needs manual review
                    </span>
                  ) : null}
                  {selected.marketing_emails_consent ? (
                    <span className="rounded-full bg-sand px-2 py-0.5 text-muted">
                      Marketing consent
                    </span>
                  ) : null}
                  {selected.is_test ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800">
                      Test
                    </span>
                  ) : null}
                </div>
              </dl>

              <button
                type="button"
                className="btn-ghost mt-4 px-0 text-xs"
                onClick={() => setShowRaw((v) => !v)}
              >
                {showRaw ? "Hide raw payload" : "Show raw payload"}
              </button>
              {showRaw ? (
                <pre className="mt-2 max-h-64 overflow-auto rounded-xl bg-sand/60 p-3 text-[11px] leading-relaxed text-muted">
                  {JSON.stringify(selected.raw_payload, null, 2)}
                </pre>
              ) : null}
            </div>
            <div className="flex gap-2 border-t border-border px-4 py-3">
              <button
                type="button"
                className="btn-ghost text-[var(--danger)]"
                disabled={saving}
                onClick={() => void remove(selected.id)}
              >
                Delete
              </button>
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
}
