"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Download, Inbox } from "lucide-react";
import type { WebEnquiry } from "@/lib/types";
import {
  computeEnquiryStats,
  enquiryInDateRange,
  enquiryReferrerKey,
  enquiryReferrerLabel,
  enquirySourceLabel,
  getEnquiryAttribution,
  isGoogleAdsEnquiry,
} from "@/lib/data/web-enquiries-stats";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar, matchesSearch } from "@/components/ui/FilterBar";
import { EnquiryYearCompare } from "@/components/enquiries/EnquiryYearCompare";
import { cn } from "@/lib/utils";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

function vesselLabel(e: WebEnquiry): string {
  const raw = asRecord(e.raw_payload);
  const shipment = asRecord(raw.shipment);
  const form = asRecord(raw.form_fields);
  const make = asRecord(e.make_fields);
  return (
    asString(shipment.yacht_vessel_name) ||
    asString(form["Yacht Name"]) ||
    asString(make.yacht_vessel_name) ||
    asString(shipment.make_model) ||
    asString(form["Make & Model"]) ||
    ""
  );
}

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
  const raw = asRecord(e.raw_payload);
  if (asString(raw.message)) return asString(raw.message);
  const make = asRecord(e.make_fields);
  if (asString(make.message)) return asString(make.message);
  const form = asRecord(raw.form_fields);
  return (
    asString(form["Message / additional information"]) ||
    asString(
      form[
        "Any additional or specific information you feel is important to note?"
      ]
    )
  );
}

function entriesFrom(
  obj: Record<string, unknown> | undefined,
  labels?: Record<string, string>,
  opts?: { keepNo?: boolean }
): { label: string; value: string }[] {
  if (!obj) return [];
  const out: { label: string; value: string }[] = [];
  for (const [key, val] of Object.entries(obj)) {
    if (val == null || val === "") continue;
    if (typeof val === "object") continue;
    const value = asString(val);
    if (!value) continue;
    const lower = value.toLowerCase();
    if (!opts?.keepNo && (lower === "n/a" || lower === "-")) continue;
    out.push({
      label: labels?.[key] ?? key.replace(/_/g, " "),
      value,
    });
  }
  return out;
}

function pickField(
  ...candidates: unknown[]
): string {
  for (const c of candidates) {
    const v = asString(c);
    if (v) return v;
  }
  return "";
}

function DetailSection({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: string }[];
}) {
  if (!rows.length) return null;
  return (
    <div className="border-t border-border pt-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
        {title}
      </h3>
      <dl className="space-y-2 text-sm">
        {rows.map((r) => (
          <div key={r.label}>
            <dt className="label !mb-0.5 capitalize">{r.label}</dt>
            <dd className="whitespace-pre-wrap text-foreground">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function buildDetailSections(e: WebEnquiry) {
  const raw = asRecord(e.raw_payload);
  const customer = asRecord(raw.customer);
  const membership = asRecord(raw.membership);
  const route = asRecord(raw.route);
  const shipment = asRecord(raw.shipment);
  const racing = asRecord(raw.racing);
  const timing = asRecord(raw.timing);
  const consent = asRecord(raw.consent);
  const tracking = asRecord(raw.tracking);
  const form = asRecord(raw.form_fields);
  const make = asRecord(e.make_fields);
  const nonEmpty = asRecord(raw.non_empty_form_fields);

  const customerRows = [
    { label: "Name", value: e.customer_name || asString(customer.name) },
    { label: "Email", value: e.customer_email || asString(customer.email) },
    { label: "Phone", value: e.customer_phone || asString(customer.phone) },
    {
      label: "Country",
      value: e.customer_country || asString(customer.country),
    },
    {
      label: "Company",
      value: asString(customer.company) || asString(make.company),
    },
  ].filter((r) => r.value);

  const serviceRows = [
    {
      label: "Service",
      value: (e.final_service_category || e.user_selected_service || "").replace(
        /_/g,
        " "
      ),
    },
    {
      label: "User selected",
      value: e.user_selected_service.replace(/_/g, " "),
    },
    { label: "Office", value: e.selected_office },
    { label: "Office email", value: e.office_email },
    { label: "Routing", value: e.routing_reason },
  ].filter((r) => r.value);

  const vesselName = pickField(
    shipment.yacht_vessel_name,
    form["Yacht Name"],
    nonEmpty.yacht_vessel_name,
    nonEmpty.yacht_name,
    make.yacht_vessel_name
  );
  const makeModel = pickField(
    shipment.make_model,
    form["Make & Model"],
    nonEmpty.make_model,
    nonEmpty.yacht_make_model
  );

  const vesselRows = [
    { label: "Yacht / vessel name", value: vesselName },
    { label: "Make & model", value: makeModel },
    {
      label: "Year of build",
      value: pickField(
        shipment.yacht_year_of_build,
        form["Year of build"],
        nonEmpty.yacht_year_of_build
      ),
    },
    {
      label: "Length",
      value: pickField(shipment.length, form.Length, nonEmpty.length),
    },
    {
      label: "Width",
      value: pickField(shipment.width, form.Width, nonEmpty.width),
    },
    {
      label: "Draft",
      value: pickField(shipment.draft, form.Draft, nonEmpty.draft),
    },
    {
      label: "Height",
      value: pickField(shipment.height, form.Height, nonEmpty.height),
    },
    {
      label: "Weight",
      value: pickField(shipment.weight, form.Weight, nonEmpty.weight),
    },
    {
      label: "Approx. value",
      value: pickField(
        shipment.approximate_value,
        form["Value (approx)"],
        nonEmpty.approximate_value
      ),
    },
    {
      label: "Own cradle",
      value: pickField(shipment.own_cradle, form["Own cradle"]),
    },
    {
      label: "Own container",
      value: pickField(shipment.own_container, form["Own container"]),
    },
    {
      label: "Cargo description",
      value: pickField(
        shipment.cargo_description,
        form["Cargo Description"],
        nonEmpty.cargo_description
      ),
    },
    {
      label: "Hazardous goods",
      value: pickField(
        shipment.hazardous_goods,
        form["Hazardous goods"],
        form.hazardous_goods
      ),
    },
    {
      label: "Goods in transit insurance",
      value: pickField(
        shipment.goods_in_transit_insurance,
        form["Goods in Transit insurance"],
        form.goods_in_transit_insurance
      ),
    },
    {
      label: "Reason for shipping",
      value: pickField(
        shipment.reason_for_shipping,
        form["Reason for shipping"],
        form.reason_for_shipping
      ),
    },
    {
      label: "Vehicle",
      value: pickField(
        shipment.vehicle_make_model_year,
        form.Vehicle,
        nonEmpty.vehicle_make_model_year
      ),
    },
    {
      label: "Vehicle driveable",
      value: pickField(shipment.vehicle_driveable, form["Vehicle driveable"]),
    },
    {
      label: "Cargo context",
      value: pickField(
        shipment.general_cargo_context,
        form["Cargo context (general cargo)"]
      ),
    },
  ].filter((r) => r.value);

  const journeyRows = [
    {
      label: "From",
      value:
        e.collection_location ||
        asString(route.collection_location) ||
        [asString(route.collection_country), asString(route.collection_location)]
          .filter(Boolean)
          .join(", "),
    },
    {
      label: "To",
      value:
        e.delivery_location ||
        asString(route.delivery_location) ||
        [asString(route.delivery_country), asString(route.delivery_location)]
          .filter(Boolean)
          .join(", "),
    },
    ...entriesFrom(tracking, {
      sailing_schedule_reference: "Sailing schedule",
      sailing_schedule_vessel_slug: "Schedule vessel",
      sailing_departure_region: "Departure region",
      sailing_arrival_region: "Arrival region",
    }),
  ].filter((r) => r.value);

  const attr = getEnquiryAttribution(e);
  const attributionRows = [
    { label: "Source", value: attr.sourceLabel },
    { label: "How they heard about us", value: attr.heardAbout },
    { label: "Campaign", value: attr.utmCampaign },
    { label: "Keyword / term", value: attr.utmTerm },
    { label: "UTM source", value: attr.utmSource },
    { label: "UTM medium", value: attr.utmMedium },
    { label: "UTM content", value: attr.utmContent },
    { label: "Google click ID (gclid)", value: attr.gclid },
    { label: "gbraid", value: attr.gbraid },
    { label: "wbraid", value: attr.wbraid },
    { label: "Ads campaign ID (hsa_cam)", value: attr.hsaCam },
    { label: "Ads ad ID (hsa_ad)", value: attr.hsaAd },
    { label: "Ads group ID (hsa_grp)", value: attr.hsaGrp },
    { label: "Referrer", value: attr.referrer },
    { label: "Landing / page URL", value: attr.pageUrl },
  ].filter((r) => r.value);

  const racingRows = entriesFrom(racing, {
    regatta_event: "Regatta / event",
    racing_programme: "Programme",
    is_racing_related: "Racing related",
  });

  const timingRows = entriesFrom(timing, {
    preferred_departure_date: "Preferred departure",
    preferred_arrival_date: "Preferred arrival",
    date_flexibility: "Flexibility",
    timing_notes: "Timing notes",
  });

  const membershipRows = entriesFrom(membership, {
    is_member: "Member",
    membership_type: "Membership type",
    organisation_name: "Organisation / club",
  });

  const consentRows = entriesFrom(consent, {
    marketing_emails_consent: "Marketing emails",
    advertising_personalisation_consent: "Advertising personalisation",
    data_processing_consent: "Data processing",
  });

  const shown = new Set(
    [
      ...customerRows,
      ...serviceRows,
      ...vesselRows,
      ...journeyRows,
      ...attributionRows,
      ...racingRows,
      ...timingRows,
      ...membershipRows,
      ...consentRows,
    ].map((r) => r.label.toLowerCase())
  );
  const extraForm: { label: string; value: string }[] = [];
  for (const [k, v] of Object.entries(form)) {
    const value = asString(v);
    if (!value) continue;
    const label = k;
    if (shown.has(label.toLowerCase())) continue;
    if (
      /^(id|submission|webhook|ga4|created_ip|user agent|month|year)$/i.test(k)
    ) {
      continue;
    }
    if (
      [
        "Name",
        "Email",
        "Phone",
        "Country",
        "customer_name",
        "customer_email",
        "customer_phone",
        "customer_country",
        "collection_location",
        "delivery_location",
        "Transport from",
        "Transport to",
        "selected_office",
        "Selected Office",
        "office_email",
        "Sent to Office",
        "submission_id",
        "Submission ID",
        "created_at",
        "Created At",
        "service_category",
        "user_selected_service",
        "needs_manual_review",
        "routing_basis",
        "Routing Basis",
        "Routing Reason",
        "routing_reason",
        "Yacht Name",
        "Make & Model",
        "Year of build",
        "Length",
        "Width",
        "Draft",
        "Height",
        "Weight",
        "Value (approx)",
        "Own cradle",
        "Own container",
        "Referrer",
        "Page Location",
        "How did you hear about us?",
      ].includes(k)
    ) {
      continue;
    }
    extraForm.push({ label, value });
  }

  return {
    vesselName,
    makeModel,
    customerRows,
    serviceRows,
    vesselRows,
    journeyRows,
    attributionRows,
    racingRows,
    timingRows,
    membershipRows,
    consentRows,
    extraForm,
    message: enquiryMessage(e),
  };
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
    "source",
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
        enquirySourceLabel(r),
        r.is_test,
        r.routing_reason,
      ]
        .map(escape)
        .join(",")
    ),
  ];
  const blob = new Blob([lines.join("\n")], {
    type: "text/csv;charset=utf-8",
  });
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
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [officeFilter, setOfficeFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [referrerFilter, setReferrerFilter] = useState("all");
  const [manualRouteOnly, setManualRouteOnly] = useState(false);
  const [showTest, setShowTest] = useState(false);
  const [showHistory, setShowHistory] = useState(true);
  const [showAdsCampaigns, setShowAdsCampaigns] = useState(false);
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

  /** Date + test filter — base pool for list/options. */
  const dated = useMemo(() => {
    return items.filter((e) => {
      if (!showTest && e.is_test) return false;
      return enquiryInDateRange(e, dateFrom, dateTo);
    });
  }, [items, showTest, dateFrom, dateTo]);

  const offices = useMemo(() => {
    const set = new Set(dated.map((e) => e.selected_office).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [dated]);

  function matchesListFilters(e: WebEnquiry): boolean {
    if (manualRouteOnly && !e.needs_manual_review) return false;
    if (officeFilter !== "all") {
      const office = e.selected_office?.trim() || "Unassigned";
      if (office !== officeFilter) return false;
    }
    if (sourceFilter !== "all" && enquirySourceLabel(e) !== sourceFilter) {
      return false;
    }
    if (referrerFilter !== "all") {
      if (!isGoogleAdsEnquiry(e)) return false;
      if (enquiryReferrerKey(e) !== referrerFilter) return false;
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
      enquirySourceLabel(e),
      enquiryReferrerKey(e),
      vesselLabel(e),
    ]);
  }

  const filtered = useMemo(() => {
    return dated.filter(matchesListFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- matchesListFilters closes over filter state
  }, [
    dated,
    search,
    officeFilter,
    sourceFilter,
    referrerFilter,
    manualRouteOnly,
  ]);

  /** Overview KPIs + summaries for the date range (before chip filters). */
  const rangeStats = useMemo(
    () => computeEnquiryStats(dated, { includeTest: true }),
    [dated]
  );

  /** YoY table respects attribute filters, but not the date range (needs full years). */
  const yearCompareItems = useMemo(() => {
    return items.filter((e) => {
      if (!showTest && e.is_test) return false;
      return matchesListFilters(e);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    items,
    showTest,
    search,
    officeFilter,
    sourceFilter,
    referrerFilter,
    manualRouteOnly,
  ]);

  const hasActiveChips =
    officeFilter !== "all" ||
    sourceFilter !== "all" ||
    referrerFilter !== "all" ||
    manualRouteOnly;

  function clearChips() {
    setOfficeFilter("all");
    setSourceFilter("all");
    setReferrerFilter("all");
    setManualRouteOnly(false);
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

  const detail = selected ? buildDetailSections(selected) : null;

  return (
    <div>
      <PageHeader
        title="Web Enquiries"
        description="Website quote form submissions — live via WordPress webhook, with imported history."
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

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search name, email, vessel, route, office…"
        resultCount={filtered.length}
        totalCount={dated.length}
        dateRange={{
          from: dateFrom,
          to: dateTo,
          onFromChange: setDateFrom,
          onToChange: setDateTo,
          fromLabel: "From",
          toLabel: "To",
        }}
        selects={[
          {
            id: "office",
            label: "Office",
            value: officeFilter,
            onChange: setOfficeFilter,
            options: [
              { value: "all", label: "All offices" },
              ...offices.map((o) => ({ value: o, label: o })),
              ...(rangeStats.byOffice.some((o) => o.label === "Unassigned")
                ? [{ value: "Unassigned", label: "Unassigned" }]
                : []),
            ],
          },
        ]}
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            className="rounded border-border"
            checked={manualRouteOnly}
            onChange={(e) => setManualRouteOnly(e.target.checked)}
          />
          Manual routing only
          {rangeStats.needsReview > 0 ? (
            <span className="rounded-full bg-sand px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-foreground">
              {rangeStats.needsReview}
            </span>
          ) : null}
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            className="rounded border-border"
            checked={showTest}
            onChange={(e) => setShowTest(e.target.checked)}
          />
          Show test rows
        </label>
        {hasActiveChips ? (
          <button type="button" className="btn-ghost text-xs" onClick={clearChips}>
            Clear filters
          </button>
        ) : null}
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="surface-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            This week
          </p>
          <p className="mt-1 font-display text-2xl text-brand">
            {rangeStats.thisWeek}
          </p>
        </div>
        <div className="surface-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            This month
          </p>
          <p className="mt-1 font-display text-2xl text-brand">
            {rangeStats.thisMonth}
          </p>
        </div>
        <div className="surface-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {dateFrom || dateTo ? "In date range" : "Total"}
          </p>
          <p className="mt-1 font-display text-2xl text-brand">
            {rangeStats.total}
          </p>
        </div>
        <button
          type="button"
          className={cn(
            "surface-card p-4 text-left transition hover:-translate-y-0.5 hover:border-accent",
            sourceFilter === "Google Ads" && "border-brand bg-accent-soft/40"
          )}
          onClick={() =>
            setSourceFilter((cur) =>
              cur === "Google Ads" ? "all" : "Google Ads"
            )
          }
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Google Ads
          </p>
          <p className="mt-1 font-display text-2xl text-brand">
            {rangeStats.googleAds}
          </p>
        </button>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        {rangeStats.byOffice.length > 0 ? (
          <div className="surface-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              By office
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {rangeStats.byOffice.map((o) => (
                <li key={o.label}>
                  <button
                    type="button"
                    className={cn(
                      "rounded-full border border-border px-3 py-1 text-xs transition",
                      officeFilter === o.label
                        ? "border-brand bg-accent-soft text-brand"
                        : "bg-sand/50 text-muted hover:text-foreground"
                    )}
                    onClick={() =>
                      setOfficeFilter((cur) =>
                        cur === o.label ? "all" : o.label
                      )
                    }
                  >
                    {o.label} · {o.count}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {rangeStats.topSources.length > 0 ? (
          <div className="surface-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Source
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {rangeStats.topSources.map((s) => (
                <li key={s.label}>
                  <button
                    type="button"
                    className={cn(
                      "rounded-full border border-border px-3 py-1 text-xs transition",
                      sourceFilter === s.label
                        ? "border-brand bg-accent-soft text-brand"
                        : "bg-sand/50 text-muted hover:text-foreground"
                    )}
                    onClick={() =>
                      setSourceFilter((cur) =>
                        cur === s.label ? "all" : s.label
                      )
                    }
                  >
                    {s.label} · {s.count}
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted">
              Google Ads from page/referrer params (gclid, utm, hsa_*).
            </p>
          </div>
        ) : null}
      </div>

      {rangeStats.googleAdsByReferrer.length > 0 ? (
        <div className="surface-card mb-6 overflow-hidden">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            onClick={() => setShowAdsCampaigns((v) => !v)}
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Google Ads campaigns
              </p>
              <p className="mt-0.5 text-sm text-foreground">
                {rangeStats.googleAds} attributed ·{" "}
                {rangeStats.googleAdsByReferrer.length} campaigns
              </p>
            </div>
            <span className="text-xs font-medium text-brand">
              {showAdsCampaigns ? "Hide" : "Show"}
            </span>
          </button>
          {showAdsCampaigns ? (
            <ul className="divide-y divide-border border-t border-border">
              {rangeStats.googleAdsByReferrer.map((r) => {
                const active = referrerFilter === r.label;
                const share =
                  rangeStats.googleAds > 0
                    ? Math.round((r.count / rangeStats.googleAds) * 100)
                    : 0;
                return (
                  <li key={r.label}>
                    <button
                      type="button"
                      title={r.label}
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition",
                        active
                          ? "bg-accent-soft/70"
                          : "bg-white hover:bg-sand/40"
                      )}
                      onClick={() => {
                        setSourceFilter("Google Ads");
                        setReferrerFilter((cur) =>
                          cur === r.label ? "all" : r.label
                        );
                      }}
                    >
                      <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                        {enquiryReferrerLabel(r.label, 64)}
                      </span>
                      <span className="shrink-0 tabular-nums text-xs text-muted">
                        {share}%
                      </span>
                      <span className="shrink-0 rounded-full bg-sand px-2 py-0.5 text-xs font-semibold tabular-nums">
                        {r.count}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="mb-6">
        <button
          type="button"
          className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted hover:text-brand"
          onClick={() => setShowHistory((v) => !v)}
        >
          Enquiry history {showHistory ? "▾" : "▸"}
        </button>
        {showHistory ? (
          <EnquiryYearCompare items={yearCompareItems} includeTest />
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <div className="surface-card flex flex-col items-center gap-3 px-6 py-16 text-center">
          <Inbox className="h-8 w-8 text-muted" />
          <p className="text-sm font-medium text-foreground">No enquiries match</p>
          <p className="max-w-md text-sm text-muted">
            Try clearing the date range or filters. New submissions appear when
            the Quote Builder webhook is connected.
          </p>
        </div>
      ) : (
        <div className="surface-card overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-border bg-sand/40 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Vessel</th>
                <th className="px-4 py-3 font-medium">Service</th>
                <th className="px-4 py-3 font-medium">Route</th>
                <th className="px-4 py-3 font-medium">Office</th>
                <th className="px-4 py-3 font-medium">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((e) => {
                const vessel = vesselLabel(e);
                return (
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
                    <td className="max-w-[140px] truncate px-4 py-3 text-muted">
                      {vessel || "—"}
                    </td>
                    <td className="px-4 py-3 capitalize text-muted">
                      {(
                        e.final_service_category ||
                        e.user_selected_service ||
                        "—"
                      ).replace(/_/g, " ")}
                      {e.needs_manual_review ? (
                        <span className="mt-1 block text-[10px] font-medium uppercase text-[var(--danger)]">
                          Manual route
                        </span>
                      ) : null}
                    </td>
                    <td className="max-w-[160px] truncate px-4 py-3 text-muted">
                      {[e.collection_location, e.delivery_location]
                        .filter(Boolean)
                        .join(" → ") || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {e.selected_office || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {enquirySourceLabel(e)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {selected && detail ? (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/25 md:left-sidebar"
            onClick={closeDrawer}
            aria-hidden
          />
          <aside
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-border bg-white shadow-soft"
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
                {detail.vesselName ? (
                  <p className="mt-1 text-sm text-foreground">
                    <span className="text-muted">Vessel:</span>{" "}
                    {detail.vesselName}
                    {detail.makeModel ? (
                      <span className="text-muted"> · {detail.makeModel}</span>
                    ) : null}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                className="btn-ghost px-2.5 py-1.5 text-xs"
                onClick={closeDrawer}
              >
                Close
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              <p className="text-xs text-muted">
                Submitted {formatDate(selected.created_at ?? selected.received_at)}{" "}
                · Source: {enquirySourceLabel(selected)}
              </p>

              <DetailSection title="Customer" rows={detail.customerRows} />
              <DetailSection title="Vessel / cargo" rows={detail.vesselRows} />
              <DetailSection title="Service & routing" rows={detail.serviceRows} />
              <DetailSection title="Journey" rows={detail.journeyRows} />
              <DetailSection
                title="Attribution / Google Ads"
                rows={detail.attributionRows}
              />
              <DetailSection title="Racing" rows={detail.racingRows} />
              <DetailSection title="Timing" rows={detail.timingRows} />
              <DetailSection title="Membership" rows={detail.membershipRows} />
              <DetailSection title="Consent" rows={detail.consentRows} />

              {detail.message ? (
                <div className="border-t border-border pt-3">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                    Message
                  </h3>
                  <p className="whitespace-pre-wrap text-sm text-foreground">
                    {detail.message}
                  </p>
                </div>
              ) : null}

              <DetailSection title="More fields" rows={detail.extraForm} />

              {selected.needs_manual_review ||
              selected.marketing_emails_consent ||
              selected.is_test ? (
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
              ) : null}

              <button
                type="button"
                className="btn-ghost px-0 text-xs"
                onClick={() => setShowRaw((v) => !v)}
              >
                {showRaw ? "Hide raw payload" : "Show raw payload"}
              </button>
              {showRaw ? (
                <pre className="max-h-64 overflow-auto rounded-xl bg-sand/60 p-3 text-[11px] leading-relaxed text-muted">
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
