import { uid } from "@/lib/utils";
import { readStore, updateStore } from "@/lib/store/local";
import type {
  AwardEntry,
  Contact,
  ContentItem,
  ContentStatus,
  EventItem,
  HubAccessRole,
  HubTask,
  HubUser,
  MerchInventoryItem,
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

export async function getSponsorship(id: string) {
  const store = await readStore();
  const item = store.sponsorships.find((c) => c.id === id);
  if (!item) return null;
  return item.kind === "membership" || item.kind === "sponsorship"
    ? item
    : { ...item, kind: "sponsorship" as const };
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
  return store.contacts.map(normalizeContact);
}

function normalizeContact(c: Contact): Contact {
  return { ...c, user_id: c.user_id ?? null };
}

export async function getContactByUserId(userId: string) {
  const contacts = await listContacts();
  return contacts.find((c) => c.user_id === userId) ?? null;
}

export async function getContactByEmail(email: string) {
  const needle = email.trim().toLowerCase();
  if (!needle) return null;
  const contacts = await listContacts();
  return (
    contacts.find((c) => c.email.trim().toLowerCase() === needle) ?? null
  );
}

/**
 * Link a hub user to at most one contact. Pass null to unlink.
 * Clears the link from any other contact that had this user.
 */
export async function linkUserToContact(
  userId: string,
  contactId: string | null
) {
  let linked: Contact | null = null;
  await updateStore((s) => {
    for (let i = 0; i < s.contacts.length; i++) {
      const c = normalizeContact(s.contacts[i]);
      if (c.user_id === userId) {
        s.contacts[i] = { ...c, user_id: null, updated_at: nowIso() };
      }
    }
    if (!contactId) return;
    const idx = s.contacts.findIndex((c) => c.id === contactId);
    if (idx === -1) return;
    const next = {
      ...normalizeContact(s.contacts[idx]),
      user_id: userId,
      updated_at: nowIso(),
    };
    s.contacts[idx] = next;
    linked = next;
  });
  return linked;
}

export async function createContact(
  input: Omit<Contact, "id" | "created_at" | "updated_at">
) {
  const item: Contact = {
    ...input,
    user_id: input.user_id ?? null,
    id: uid("ctc"),
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await updateStore((s) => {
    if (item.user_id) {
      for (let i = 0; i < s.contacts.length; i++) {
        const c = normalizeContact(s.contacts[i]);
        if (c.user_id === item.user_id) {
          s.contacts[i] = { ...c, user_id: null, updated_at: nowIso() };
        }
      }
    }
    s.contacts.push(item);
  });
  return item;
}

export async function updateContact(id: string, patch: Partial<Contact>) {
  let updated: Contact | null = null;
  await updateStore((s) => {
    const idx = s.contacts.findIndex((c) => c.id === id);
    if (idx === -1) return;
    const nextUserId =
      patch.user_id !== undefined
        ? patch.user_id
        : normalizeContact(s.contacts[idx]).user_id;
    if (nextUserId) {
      for (let i = 0; i < s.contacts.length; i++) {
        if (i === idx) continue;
        const c = normalizeContact(s.contacts[i]);
        if (c.user_id === nextUserId) {
          s.contacts[i] = { ...c, user_id: null, updated_at: nowIso() };
        }
      }
    }
    s.contacts[idx] = {
      ...normalizeContact(s.contacts[idx]),
      ...patch,
      id,
      updated_at: nowIso(),
    };
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
  const quarterOrder = { Q1: 1, Q2: 2, Q3: 3, Q4: 4 } as const;
  return [...store.themes].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return quarterOrder[a.quarter] - quarterOrder[b.quarter];
  });
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

export async function getMerchOrder(id: string) {
  const store = await readStore();
  return store.merch_orders.find((o) => o.id === id) ?? null;
}

export async function createMerchOrder(
  input: Omit<MerchOrder, "id" | "created_at" | "updated_at">
) {
  const item: MerchOrder = {
    ...input,
    created_by_user_id: input.created_by_user_id ?? null,
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
    const nextPatch = { ...patch };
    delete nextPatch.id;
    delete nextPatch.created_by_user_id;
    s.merch_orders[idx] = {
      ...s.merch_orders[idx],
      ...nextPatch,
      id,
      created_by_user_id: s.merch_orders[idx].created_by_user_id ?? null,
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

export async function listMerchInventory() {
  const store = await readStore();
  return [...store.merch_inventory].sort((a, b) => {
    const itemCmp = a.item.localeCompare(b.item);
    if (itemCmp !== 0) return itemCmp;
    const fitCmp = (a.fit || "").localeCompare(b.fit || "");
    if (fitCmp !== 0) return fitCmp;
    return a.size.localeCompare(b.size);
  });
}

export async function createMerchInventoryItem(
  input: Omit<MerchInventoryItem, "id" | "created_at" | "updated_at">
) {
  const item: MerchInventoryItem = {
    ...input,
    id: uid("inv"),
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await updateStore((s) => {
    s.merch_inventory.push(item);
  });
  return item;
}

export async function updateMerchInventoryItem(
  id: string,
  patch: Partial<MerchInventoryItem>
) {
  let updated: MerchInventoryItem | null = null;
  await updateStore((s) => {
    const idx = s.merch_inventory.findIndex((c) => c.id === id);
    if (idx === -1) return;
    s.merch_inventory[idx] = {
      ...s.merch_inventory[idx],
      ...patch,
      id,
      updated_at: nowIso(),
    };
    updated = s.merch_inventory[idx];
  });
  return updated;
}

export async function deleteMerchInventoryItem(id: string) {
  await updateStore((s) => {
    s.merch_inventory = s.merch_inventory.filter((c) => c.id !== id);
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

const HUB_ACCESS_ROLES: HubAccessRole[] = ["admin", "member", "external"];

function normalizeHubAccessRole(value: unknown): HubAccessRole {
  const role = String(value ?? "").toLowerCase();
  return HUB_ACCESS_ROLES.includes(role as HubAccessRole)
    ? (role as HubAccessRole)
    : "member";
}

export async function listHubUsers() {
  const store = await readStore();
  return [...(store.hub_users ?? [])].sort((a, b) => {
    const roleOrder = { admin: 0, member: 1, external: 2 } as const;
    const byRole = roleOrder[a.role] - roleOrder[b.role];
    if (byRole !== 0) return byRole;
    return a.full_name.localeCompare(b.full_name);
  });
}

/** Resolve Admin → Users directory role for a signed-in email. */
export async function getHubAccessRoleByEmail(
  email: string
): Promise<HubAccessRole | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  const users = await listHubUsers();
  return users.find((u) => u.email === normalized)?.role ?? null;
}

export async function createHubUser(
  input: Omit<HubUser, "id" | "created_at" | "updated_at">
) {
  const item: HubUser = {
    ...input,
    role: normalizeHubAccessRole(input.role),
    email: input.email.trim().toLowerCase(),
    full_name: input.full_name.trim() || input.email.trim(),
    notes: input.notes ?? "",
    id: uid("usr"),
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await updateStore((s) => {
    if (!s.hub_users) s.hub_users = [];
    s.hub_users.push(item);
  });
  return item;
}

export async function updateHubUser(id: string, patch: Partial<HubUser>) {
  let updated: HubUser | null = null;
  await updateStore((s) => {
    if (!s.hub_users) s.hub_users = [];
    const idx = s.hub_users.findIndex((u) => u.id === id);
    if (idx === -1) return;
    const next = {
      ...s.hub_users[idx],
      ...patch,
      id,
      updated_at: nowIso(),
    };
    if (patch.role !== undefined) next.role = normalizeHubAccessRole(patch.role);
    if (patch.email !== undefined) next.email = patch.email.trim().toLowerCase();
    if (patch.full_name !== undefined) next.full_name = patch.full_name.trim();
    s.hub_users[idx] = next;
    updated = s.hub_users[idx];
  });
  return updated;
}

export async function deleteHubUser(id: string) {
  await updateStore((s) => {
    s.hub_users = (s.hub_users ?? []).filter((u) => u.id !== id);
  });
}
