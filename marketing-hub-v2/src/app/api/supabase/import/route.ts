import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/api";
import { hasSupabaseConfig } from "@/lib/auth/config";
import { importFromCoreData } from "@/lib/supabase/import-core";
import {
  findAwardsTable,
  findContactsTable,
  findEventsTable,
  findLegacyContentTable,
  findMediaTable,
  findMembershipsTable,
  findSocialPostsTable,
  findSponsorshipsTable,
  findTasksTable,
  findThemesTable,
  listCoreTables,
} from "@/lib/supabase/core-data";

export const dynamic = "force-dynamic";

/** Preview which Core Data tables we would use (no write). */
export async function GET() {
  const { error } = await requireStaff();
  if (error) return error;

  if (!hasSupabaseConfig()) {
    return NextResponse.json({
      configured: false,
      message:
        "Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (plus service role if needed) to .env.local",
      mapping: {
        events: "Dedicated Events table",
        content: "Social Posts table",
        sponsorships: "Sponsorships table",
        memberships: "Memberships → Partners (kind=membership)",
        contacts: "Contact table (singular)",
        awards: "Awards table",
        themes: "Quarterly Themes table",
        resources: "Media Links Resources → Library",
        tasks: "Tasks table",
        localOnly: "Merch orders, staff requests, reports (hub-only)",
        ignored: "Legacy Content table",
      },
    });
  }

  try {
    const tables = await listCoreTables();
    const events = findEventsTable(tables);
    const social = findSocialPostsTable(tables);
    const sponsorships = findSponsorshipsTable(tables);
    const memberships = findMembershipsTable(tables);
    const contacts = findContactsTable(tables);
    const awards = findAwardsTable(tables);
    const themes = findThemesTable(tables);
    const media = findMediaTable(tables);
    const tasks = findTasksTable(tables);
    const legacy = findLegacyContentTable(tables);
    return NextResponse.json({
      configured: true,
      mapping: {
        events: events
          ? { name: events.name, table: events.supabase_table }
          : null,
        contentFromSocialPosts: social
          ? { name: social.name, table: social.supabase_table }
          : null,
        sponsorships: sponsorships
          ? { name: sponsorships.name, table: sponsorships.supabase_table }
          : null,
        memberships: memberships
          ? { name: memberships.name, table: memberships.supabase_table }
          : null,
        contacts: contacts
          ? { name: contacts.name, table: contacts.supabase_table }
          : null,
        awards: awards
          ? { name: awards.name, table: awards.supabase_table }
          : null,
        themes: themes
          ? { name: themes.name, table: themes.supabase_table }
          : null,
        resourcesFromMedia: media
          ? { name: media.name, table: media.supabase_table }
          : null,
        tasks: tasks
          ? { name: tasks.name, table: tasks.supabase_table }
          : null,
        localOnly: ["merch_orders", "staff_requests", "reports"],
        legacyContentIgnored: legacy
          ? { name: legacy.name, table: legacy.supabase_table }
          : null,
      },
      tableCount: tables.length,
    });
  } catch (e) {
    return NextResponse.json(
      {
        configured: true,
        error: e instanceof Error ? e.message : "Failed to list tables",
      },
      { status: 500 }
    );
  }
}

/** Pull Core Data tables into the hub store (existing tables + leave hub-only like merch). */
export async function POST() {
  const { error } = await requireStaff();
  if (error) return error;

  if (!hasSupabaseConfig()) {
    return NextResponse.json(
      {
        error:
          "Supabase not configured. Add URL + anon key to marketing-hub-v2/.env.local",
      },
      { status: 503 }
    );
  }

  try {
    const result = await importFromCoreData();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Import failed" },
      { status: 500 }
    );
  }
}
