import {
  createWhatsAppHubEnquiry,
  listHubEnquiries,
  updateWhatsAppHubEnquiry,
} from "@/lib/data/hub-enquiries";
import type { WhatsAppEnquiryInput } from "@/lib/data/whatsapp-enquiries";
import type { EnquiryIntake, HubEnquiry } from "@/lib/types";

export type EnquirySummary = {
  id: string;
  external_id: string;
  channel: EnquiryIntake;
  status: string;
  tracker_status: string;
  customer_name: string;
  company: string;
  customer_phone: string;
  customer_email: string;
  category: string;
  enquiry_type: string;
  vessel_cargo: string;
  collection_location: string;
  delivery_location: string;
  dimensions: string;
  declared_value: string;
  preferred_timeframe: string;
  selected_office: string;
  sent_to_office_at: string | null;
  follow_up_at: string | null;
  email_subject: string;
  source: string;
  message: string;
  notes: string;
  created_at: string | null;
  received_at: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown, fallback = ""): string {
  if (value == null) return fallback;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return fallback;
}

function enquiryMessage(e: HubEnquiry): string {
  const raw = asRecord(e.raw_payload);
  if (asString(raw.message)) return asString(raw.message);
  const make = asRecord(e.make_fields);
  return asString(make.message);
}

function toSummary(e: HubEnquiry): EnquirySummary {
  return {
    id: e.id,
    external_id: e.submission_id,
    channel: e.channel,
    status: e.status,
    tracker_status: e.tracker_status ?? "",
    customer_name: e.customer_name,
    company: e.company ?? "",
    customer_phone: e.customer_phone,
    customer_email: e.customer_email,
    category: e.category ?? "",
    enquiry_type: e.final_service_category || e.user_selected_service,
    vessel_cargo: e.vessel_cargo ?? "",
    collection_location: e.collection_location,
    delivery_location: e.delivery_location,
    dimensions: e.dimensions ?? "",
    declared_value: e.declared_value ?? "",
    preferred_timeframe: e.preferred_timeframe ?? "",
    selected_office: e.selected_office,
    sent_to_office_at: e.sent_to_office_at ?? e.created_at,
    follow_up_at: e.follow_up_at ?? null,
    email_subject: e.email_subject ?? "",
    source: e.tracker_source ?? "",
    message: enquiryMessage(e),
    notes: e.routing_reason,
    created_at: e.created_at,
    received_at: e.received_at,
  };
}

const trackerFields = {
  external_id: true,
  sent_to_office_at: true,
  follow_up_at: true,
  customer_name: true,
  company: true,
  customer_phone: true,
  customer_email: true,
  customer_country: true,
  category: true,
  enquiry_type: true,
  service: true,
  vessel_cargo: true,
  collection_location: true,
  delivery_location: true,
  dimensions: true,
  declared_value: true,
  preferred_timeframe: true,
  selected_office: true,
  office_email: true,
  tracker_status: true,
  email_subject: true,
  source: true,
  message: true,
  notes: true,
  is_test: true,
} as const;

export async function createWhatsAppEnquiryFromMcp(
  input: WhatsAppEnquiryInput
): Promise<EnquirySummary> {
  const item = await createWhatsAppHubEnquiry(input);
  return toSummary(item);
}

export async function updateWhatsAppEnquiryFromMcp(
  input: WhatsAppEnquiryInput & { id?: string; external_id?: string }
): Promise<EnquirySummary> {
  const item = await updateWhatsAppHubEnquiry(input);
  if (!item) {
    throw new Error(
      `WhatsApp enquiry not found (${input.external_id || input.id || "missing id"})`
    );
  }
  return toSummary(item);
}

export async function listEnquiriesForMcp(input: {
  channel?: EnquiryIntake;
  include_test?: boolean;
  limit?: number;
}): Promise<EnquirySummary[]> {
  const items = await listHubEnquiries({
    channel: input.channel,
    includeTest: Boolean(input.include_test),
    limit: Math.min(Math.max(input.limit ?? 25, 1), 100),
  });
  return items.map(toSummary);
}

export { trackerFields };
