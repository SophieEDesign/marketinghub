import { uid } from "@/lib/utils";
import { readStore, updateStore } from "@/lib/store/local";
import type {
  AwardEntry,
  Contact,
  ContentItem,
  ContentStatus,
  EventItem,
  HubTask,
  MerchOrder,
  QuarterlyTheme,
  ReportLink,
  ResourceLink,
  Sponsorship,
  SponsorshipStatus,
  StaffRequest,
  ThemeMainContent,
  ThemeOffshoot,
} from "@/lib/types";

function nowIso() {
  return new Date().toISOString();
}

export async function listEvents() {
  const store = await readStore();
  return [...store.events].sort((a, b) => {
    if (!a.starts_at && !b.starts_at) return a.title.localeCompare(b.title);
    if (!a.starts_at) return 1;
    if (!b.starts_at) return -1;
    return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
  });
}

export async function createEvent(
  input: Omit<EventItem, "id" | "created_at" | "updated_at">
) {
  const item: EventItem = {
    ...input,
    id: uid("evt"),
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await updateStore((s) => {
    s.events.push(item);
  });
  return item;
}

export async function updateEvent(id: string, patch: Partial<EventItem>) {
  let updated: EventItem | null = null;
  await updateStore((s) => {
    const idx = s.events.findIndex((e) => e.id === id);
    if (idx === -1) return;
    s.events[idx] = {
      ...s.events[idx],
      ...patch,
      id,
      updated_at: nowIso(),
    };
    updated = s.events[idx];
  });
  return updated;
}

export async function deleteEvent(id: string) {
  await updateStore((s) => {
    s.events = s.events.filter((e) => e.id !== id);
  });
}

export async function listContent() {
  const store = await readStore();
  return store.content;
}

export async function createContent(
  input: Omit<ContentItem, "id" | "created_at" | "updated_at">
) {
  const item: ContentItem = {
    ...input,
    id: uid("cnt"),
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await updateStore((s) => {
    s.content.push(item);
  });
  return item;
}

export async function updateContent(id: string, patch: Partial<ContentItem>) {
  let updated: ContentItem | null = null;
  await updateStore((s) => {
    const idx = s.content.findIndex((c) => c.id === id);
    if (idx === -1) return;
    s.content[idx] = { ...s.content[idx], ...patch, id, updated_at: nowIso() };
    updated = s.content[idx];
  });
  return updated;
}

export async function deleteContent(id: string) {
  await updateStore((s) => {
    s.content = s.content.filter((c) => c.id !== id);
  });
}

export async function moveContentStatus(id: string, status: ContentStatus) {
  return updateContent(id, { status });
}

export async function listSponsorships() {
  const store = await readStore();
  // Backfill kind for older rows
  let changed = false;
  const items = store.sponsorships.map((s) => {
    if (s.kind === "sponsorship" || s.kind === "membership") return s;
    changed = true;
    return { ...s, kind: "sponsorship" as const };
  });
  if (changed) {
    await updateStore((st) => {
      st.sponsorships = items;
    });
  }
  return items;
}

export async function createSponsorship(
  input: Omit<Sponsorship, "id" | "created_at" | "updated_at">
) {
  const item: Sponsorship = {
    ...input,
    id: uid("spn"),
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await updateStore((s) => {
    s.sponsorships.push(item);
  });
  return item;
}

export async function updateSponsorship(
  id: string,
  patch: Partial<Sponsorship>
) {
  let updated: Sponsorship | null = null;
  await updateStore((s) => {
    const idx = s.sponsorships.findIndex((c) => c.id === id);
    if (idx === -1) return;
    s.sponsorships[idx] = {
      ...s.sponsorships[idx],
      ...patch,
      id,
      updated_at: nowIso(),
    };
    updated = s.sponsorships[idx];
  });
  return updated;
}

export async function deleteSponsorship(id: string) {
  await updateStore((s) => {
    s.sponsorships = s.sponsorships.filter((c) => c.id !== id);
  });
}

export async function setSponsorshipStatus(
  id: string,
  status: SponsorshipStatus
) {
  return updateSponsorship(id, { status });
}

export async function listContacts() {
  const store = await readStore();
  return store.contacts;
}

export async function createContact(
  input: Omit<Contact, "id" | "created_at" | "updated_at">
) {
  const item: Contact = {
    ...input,
    id: uid("ctc"),
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await updateStore((s) => {
    s.contacts.push(item);
  });
  return item;
}

export async function updateContact(id: string, patch: Partial<Contact>) {
  let updated: Contact | null = null;
  await updateStore((s) => {
    const idx = s.contacts.findIndex((c) => c.id === id);
    if (idx === -1) return;
    s.contacts[idx] = { ...s.contacts[idx], ...patch, id, updated_at: nowIso() };
    updated = s.contacts[idx];
  });
  return updated;
}

export async function deleteContact(id: string) {
  await updateStore((s) => {
    s.contacts = s.contacts.filter((c) => c.id !== id);
  });
}

export async function listResources() {
  const store = await readStore();
  return store.resources;
}

export async function createResource(
  input: Omit<ResourceLink, "id" | "created_at" | "updated_at">
) {
  const item: ResourceLink = {
    ...input,
    id: uid("res"),
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await updateStore((s) => {
    s.resources.push(item);
  });
  return item;
}

export async function updateResource(
  id: string,
  patch: Partial<ResourceLink>
) {
  let updated: ResourceLink | null = null;
  await updateStore((s) => {
    const idx = s.resources.findIndex((c) => c.id === id);
    if (idx === -1) return;
    s.resources[idx] = {
      ...s.resources[idx],
      ...patch,
      id,
      updated_at: nowIso(),
    };
    updated = s.resources[idx];
  });
  return updated;
}

export async function deleteResource(id: string) {
  await updateStore((s) => {
    s.resources = s.resources.filter((c) => c.id !== id);
  });
}

export async function listReports() {
  const store = await readStore();
  return store.reports;
}

export async function createReport(
  input: Omit<ReportLink, "id" | "created_at" | "updated_at">
) {
  const item: ReportLink = {
    ...input,
    id: uid("rpt"),
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await updateStore((s) => {
    s.reports.push(item);
  });
  return item;
}

export async function updateReport(id: string, patch: Partial<ReportLink>) {
  let updated: ReportLink | null = null;
  await updateStore((s) => {
    const idx = s.reports.findIndex((c) => c.id === id);
    if (idx === -1) return;
    s.reports[idx] = { ...s.reports[idx], ...patch, id, updated_at: nowIso() };
    updated = s.reports[idx];
  });
  return updated;
}

export async function deleteReport(id: string) {
  await updateStore((s) => {
    s.reports = s.reports.filter((c) => c.id !== id);
  });
}

export async function listThemes() {
  const store = await readStore();
  return [...store.themes].sort((a, b) => a.quarter.localeCompare(b.quarter));
}

export async function listThemeMains(themeId?: string) {
  const store = await readStore();
  return themeId
    ? store.theme_mains.filter((m) => m.theme_id === themeId)
    : store.theme_mains;
}

export async function listThemeOffshoots(mainId?: string) {
  const store = await readStore();
  return mainId
    ? store.theme_offshoots.filter((o) => o.main_content_id === mainId)
    : store.theme_offshoots;
}

export async function createTheme(
  input: Omit<QuarterlyTheme, "id" | "created_at" | "updated_at">
) {
  const item: QuarterlyTheme = {
    ...input,
    id: uid("thm"),
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await updateStore((s) => {
    s.themes.push(item);
  });
  return item;
}

export async function updateTheme(id: string, patch: Partial<QuarterlyTheme>) {
  let updated: QuarterlyTheme | null = null;
  await updateStore((s) => {
    const idx = s.themes.findIndex((t) => t.id === id);
    if (idx === -1) return;
    s.themes[idx] = { ...s.themes[idx], ...patch, id, updated_at: nowIso() };
    updated = s.themes[idx];
  });
  return updated;
}

export async function deleteTheme(id: string) {
  await updateStore((s) => {
    const mainIds = s.theme_mains
      .filter((m) => m.theme_id === id)
      .map((m) => m.id);
    s.themes = s.themes.filter((t) => t.id !== id);
    s.theme_mains = s.theme_mains.filter((m) => m.theme_id !== id);
    s.theme_offshoots = s.theme_offshoots.filter(
      (o) => !mainIds.includes(o.main_content_id)
    );
  });
}

export async function createThemeMain(
  input: Omit<ThemeMainContent, "id" | "created_at" | "updated_at">
) {
  const item: ThemeMainContent = {
    ...input,
    id: uid("tmc"),
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await updateStore((s) => {
    s.theme_mains.push(item);
  });
  return item;
}

export async function updateThemeMain(
  id: string,
  patch: Partial<ThemeMainContent>
) {
  let updated: ThemeMainContent | null = null;
  await updateStore((s) => {
    const idx = s.theme_mains.findIndex((m) => m.id === id);
    if (idx === -1) return;
    s.theme_mains[idx] = {
      ...s.theme_mains[idx],
      ...patch,
      id,
      updated_at: nowIso(),
    };
    updated = s.theme_mains[idx];
  });
  return updated;
}

export async function deleteThemeMain(id: string) {
  await updateStore((s) => {
    s.theme_mains = s.theme_mains.filter((m) => m.id !== id);
    s.theme_offshoots = s.theme_offshoots.filter(
      (o) => o.main_content_id !== id
    );
  });
}

export async function createThemeOffshoot(
  input: Omit<ThemeOffshoot, "id" | "created_at" | "updated_at">
) {
  const item: ThemeOffshoot = {
    ...input,
    id: uid("tof"),
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await updateStore((s) => {
    s.theme_offshoots.push(item);
  });
  return item;
}

export async function updateThemeOffshoot(
  id: string,
  patch: Partial<ThemeOffshoot>
) {
  let updated: ThemeOffshoot | null = null;
  await updateStore((s) => {
    const idx = s.theme_offshoots.findIndex((o) => o.id === id);
    if (idx === -1) return;
    s.theme_offshoots[idx] = {
      ...s.theme_offshoots[idx],
      ...patch,
      id,
      updated_at: nowIso(),
    };
    updated = s.theme_offshoots[idx];
  });
  return updated;
}

export async function deleteThemeOffshoot(id: string) {
  await updateStore((s) => {
    s.theme_offshoots = s.theme_offshoots.filter((o) => o.id !== id);
  });
}

export async function listMerchOrders() {
  const store = await readStore();
  return [...store.merch_orders].sort((a, b) =>
    b.created_at.localeCompare(a.created_at)
  );
}

export async function createMerchOrder(
  input: Omit<MerchOrder, "id" | "created_at" | "updated_at">
) {
  const item: MerchOrder = {
    ...input,
    id: uid("mrc"),
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await updateStore((s) => {
    s.merch_orders.push(item);
  });
  return item;
}

export async function updateMerchOrder(
  id: string,
  patch: Partial<MerchOrder>
) {
  let updated: MerchOrder | null = null;
  await updateStore((s) => {
    const idx = s.merch_orders.findIndex((c) => c.id === id);
    if (idx === -1) return;
    s.merch_orders[idx] = {
      ...s.merch_orders[idx],
      ...patch,
      id,
      updated_at: nowIso(),
    };
    updated = s.merch_orders[idx];
  });
  return updated;
}

export async function deleteMerchOrder(id: string) {
  await updateStore((s) => {
    s.merch_orders = s.merch_orders.filter((c) => c.id !== id);
  });
}

export async function listStaffRequests() {
  const store = await readStore();
  return [...store.staff_requests].sort((a, b) =>
    b.created_at.localeCompare(a.created_at)
  );
}

export async function createStaffRequest(
  input: Omit<StaffRequest, "id" | "created_at" | "updated_at">
) {
  const item: StaffRequest = {
    ...input,
    id: uid("sr"),
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await updateStore((s) => {
    s.staff_requests.push(item);
  });
  return item;
}

export async function updateStaffRequest(
  id: string,
  patch: Partial<StaffRequest>
) {
  let updated: StaffRequest | null = null;
  await updateStore((s) => {
    const idx = s.staff_requests.findIndex((c) => c.id === id);
    if (idx === -1) return;
    s.staff_requests[idx] = {
      ...s.staff_requests[idx],
      ...patch,
      id,
      updated_at: nowIso(),
    };
    updated = s.staff_requests[idx];
  });
  return updated;
}

export async function deleteStaffRequest(id: string) {
  await updateStore((s) => {
    s.staff_requests = s.staff_requests.filter((c) => c.id !== id);
  });
}

function awardFromEvent(event: EventItem): AwardEntry {
  const year =
    Number(String(event.starts_at).slice(0, 4)) || new Date().getFullYear();
  return {
    id: `awd_from_${event.id}`,
    title: event.title,
    organisation: "",
    category: "",
    year,
    status: "watching",
    ceremony_at: event.starts_at ? event.starts_at.slice(0, 10) : null,
    owner: "",
    event_id: event.id,
    notes: event.notes || "",
    created_at: event.created_at,
    updated_at: event.updated_at,
  };
}

/** Seed awards from Events typed/named as awards when the awards list is empty. */
async function ensureAwardsFromEvents() {
  const store = await readStore();
  if ((store.awards ?? []).length > 0) return;
  const fromEvents = store.events.filter(
    (e) =>
      /award/i.test(e.event_type) ||
      /award/i.test(e.title)
  );
  if (!fromEvents.length) return;
  await updateStore((s) => {
    if ((s.awards ?? []).length > 0) return;
    s.awards = fromEvents.map(awardFromEvent);
  });
}

export async function listAwards() {
  await ensureAwardsFromEvents();
  const store = await readStore();
  return [...(store.awards ?? [])].sort((a, b) => {
    const da = a.ceremony_at || `${a.year}-12-31`;
    const db = b.ceremony_at || `${b.year}-12-31`;
    return da.localeCompare(db);
  });
}

export async function createAward(
  input: Omit<AwardEntry, "id" | "created_at" | "updated_at">
) {
  const item: AwardEntry = {
    ...input,
    id: uid("awd"),
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await updateStore((s) => {
    s.awards.push(item);
  });
  return item;
}

export async function updateAward(id: string, patch: Partial<AwardEntry>) {
  let updated: AwardEntry | null = null;
  await updateStore((s) => {
    const idx = s.awards.findIndex((c) => c.id === id);
    if (idx === -1) return;
    s.awards[idx] = {
      ...s.awards[idx],
      ...patch,
      id,
      updated_at: nowIso(),
    };
    updated = s.awards[idx];
  });
  return updated;
}

export async function deleteAward(id: string) {
  await updateStore((s) => {
    s.awards = s.awards.filter((c) => c.id !== id);
  });
}

export async function listTasks() {
  const store = await readStore();
  return [...(store.tasks ?? [])].sort((a, b) => {
    const statusRank = { todo: 0, doing: 1, done: 2 };
    const sr = (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9);
    if (sr !== 0) return sr;
    const da = a.due_date || "9999-12-31";
    const db = b.due_date || "9999-12-31";
    return da.localeCompare(db);
  });
}

export async function createTask(
  input: Omit<HubTask, "id" | "created_at" | "updated_at">
) {
  const item: HubTask = {
    ...input,
    id: uid("tsk"),
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await updateStore((s) => {
    if (!s.tasks) s.tasks = [];
    s.tasks.push(item);
  });
  return item;
}

export async function updateTask(id: string, patch: Partial<HubTask>) {
  let updated: HubTask | null = null;
  await updateStore((s) => {
    if (!s.tasks) s.tasks = [];
    const idx = s.tasks.findIndex((c) => c.id === id);
    if (idx === -1) return;
    s.tasks[idx] = {
      ...s.tasks[idx],
      ...patch,
      id,
      updated_at: nowIso(),
    };
    updated = s.tasks[idx];
  });
  return updated;
}

export async function deleteTask(id: string) {
  await updateStore((s) => {
    s.tasks = (s.tasks ?? []).filter((c) => c.id !== id);
  });
}
