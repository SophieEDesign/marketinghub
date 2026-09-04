import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import {
  BRAND_CONTEXT,
  createSocialDraft,
  getSocialPost,
  listSocialPosts,
  listThemeContext,
  listUpcomingEvents,
  updateSocialPost,
} from "@/lib/mcp/content";
import {
  createWhatsAppEnquiryFromMcp,
  listEnquiriesForMcp,
  updateWhatsAppEnquiryFromMcp,
} from "@/lib/mcp/enquiries";

function jsonText(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function errorText(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true as const,
  };
}

const contentStatus = z.enum([
  "idea",
  "draft",
  "review",
  "approved",
  "scheduled",
]);

const enquiryChannel = z.enum(["web", "whatsapp"]);

export function registerHubMcpTools(server: McpServer) {
  server.registerTool(
    "get_brand_context",
    {
      title: "Brand context",
      description:
        "Peters & May brand voice, channels, and Hub workflow reminders for drafting social posts.",
      inputSchema: z.object({}),
    },
    async () => jsonText(BRAND_CONTEXT)
  );

  server.registerTool(
    "list_social_posts",
    {
      title: "List social posts",
      description:
        "List social calendar posts from the Marketing Hub. Filter by status, channel, or search text.",
      inputSchema: z.object({
        status: contentStatus.optional(),
        channel: z
          .string()
          .optional()
          .describe("e.g. LinkedIn, Instagram, Facebook"),
        search: z
          .string()
          .optional()
          .describe("Search title, caption, or notes"),
        limit: z.number().int().min(1).max(100).optional(),
      }),
    },
    async (args) => jsonText(await listSocialPosts(args))
  );

  server.registerTool(
    "get_social_post",
    {
      title: "Get social post",
      description: "Fetch one social post by Hub content id.",
      inputSchema: z.object({
        id: z.string().describe("Hub content id, e.g. cnt_..."),
      }),
    },
    async ({ id }) => {
      const post = await getSocialPost(id);
      if (!post) return errorText(`Post not found: ${id}`);
      return jsonText(post);
    }
  );

  server.registerTool(
    "create_social_draft",
    {
      title: "Create social draft",
      description:
        "Create a new social post draft in the Marketing Hub. Does not publish — use Planable to publish.",
      inputSchema: z.object({
        title: z.string().describe("Internal title / headline"),
        caption: z.string().optional().describe("Post copy / caption"),
        channels: z
          .array(z.string())
          .optional()
          .describe("Platforms, e.g. ['LinkedIn', 'Instagram']"),
        due_date: z
          .string()
          .nullable()
          .optional()
          .describe("Publish date ISO (YYYY-MM-DD or full ISO)"),
        theme_id: z
          .string()
          .nullable()
          .optional()
          .describe("Quarterly theme id from list_themes"),
        owner: z.string().optional(),
        notes: z.string().optional().describe("Internal notes, not post copy"),
        status: contentStatus
          .optional()
          .describe("Defaults to draft. Cannot be published."),
      }),
    },
    async (args) => {
      try {
        const post = await createSocialDraft(args);
        return jsonText({ ok: true, post });
      } catch (err) {
        return errorText(err instanceof Error ? err.message : "Create failed");
      }
    }
  );

  server.registerTool(
    "update_social_post",
    {
      title: "Update social post",
      description:
        "Update caption, title, channels, due date, or status on an existing Hub social post. Published posts are locked.",
      inputSchema: z.object({
        id: z.string().describe("Hub content id"),
        title: z.string().optional(),
        caption: z.string().optional(),
        channels: z.array(z.string()).optional(),
        due_date: z.string().nullable().optional(),
        theme_id: z.string().nullable().optional(),
        owner: z.string().optional(),
        notes: z.string().optional(),
        status: contentStatus.optional(),
      }),
    },
    async ({ id, ...patch }) => {
      try {
        const post = await updateSocialPost(id, patch);
        if (!post) return errorText(`Post not found: ${id}`);
        return jsonText({ ok: true, post });
      } catch (err) {
        return errorText(err instanceof Error ? err.message : "Update failed");
      }
    }
  );

  server.registerTool(
    "list_themes",
    {
      title: "List quarterly themes",
      description:
        "Quarterly marketing themes — use summaries when drafting on-brand posts.",
      inputSchema: z.object({}),
    },
    async () => jsonText(await listThemeContext())
  );

  server.registerTool(
    "list_upcoming_events",
    {
      title: "List upcoming events",
      description:
        "Upcoming events from the Hub calendar — useful for timely social post ideas.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(50).optional(),
      }),
    },
    async (args) => jsonText(await listUpcomingEvents(args.limit))
  );

  const whatsappEnquiryFields = {
    external_id: z
      .string()
      .optional()
      .describe(
        "Tracker ID e.g. WA-051. Omit on create to auto-allocate next WA-###."
      ),
    sent_to_office_at: z
      .string()
      .optional()
      .describe("Date sent to office (ISO or YYYY-MM-DD)"),
    follow_up_at: z
      .string()
      .nullable()
      .optional()
      .describe("Follow-up / chase date (ISO or YYYY-MM-DD)"),
    customer_name: z.string().optional(),
    company: z.string().optional(),
    customer_phone: z.string().optional().describe("Telephone"),
    customer_email: z.string().optional(),
    customer_country: z.string().optional(),
    category: z
      .string()
      .optional()
      .describe("Sales, Accounts, Non-sales, …"),
    enquiry_type: z
      .string()
      .optional()
      .describe("Enquiry Type e.g. Yacht transport"),
    service: z.string().optional().describe("Alias for enquiry_type"),
    vessel_cargo: z.string().optional().describe("Vessel / Cargo"),
    collection_location: z.string().optional().describe("Origin / Collection"),
    delivery_location: z.string().optional().describe("Destination"),
    dimensions: z.string().optional().describe("Dimensions / Key Specs"),
    declared_value: z.string().optional().describe("Declared / Insured Value"),
    preferred_timeframe: z.string().optional(),
    selected_office: z
      .string()
      .optional()
      .describe("Team / Office Sent To"),
    office_email: z.string().optional(),
    tracker_status: z
      .string()
      .optional()
      .describe(
        "Spreadsheet Status e.g. Sent to office, Contacted, Quoted, Follow-up required"
      ),
    email_subject: z.string().optional(),
    source: z.string().optional().describe("Source file / channel note"),
    message: z.string().optional().describe("Chat summary / message"),
    notes: z.string().optional(),
    is_test: z.boolean().optional(),
  };

  server.registerTool(
    "create_whatsapp_enquiry",
    {
      title: "Create WhatsApp enquiry",
      description:
        "Add a WhatsApp enquiry to the Marketing Hub enquiry tracker (whatsapp_enquiries). Fields match the Excel tracker. Prefer omitting external_id so the Hub allocates the next WA-###. Call once per new enquiry after drafting the handover.",
      inputSchema: z.object(whatsappEnquiryFields),
    },
    async (args) => {
      try {
        const enquiry = await createWhatsAppEnquiryFromMcp(args);
        return jsonText({ ok: true, enquiry });
      } catch (err) {
        return errorText(err instanceof Error ? err.message : "Create failed");
      }
    }
  );

  server.registerTool(
    "update_whatsapp_enquiry",
    {
      title: "Update WhatsApp enquiry",
      description:
        "Update an existing WhatsApp enquiry tracker row (chase, quote, status, office). Identify by external_id (WA-###) or id. Only send fields that changed.",
      inputSchema: z.object({
        id: z.string().optional().describe("Hub row id"),
        ...whatsappEnquiryFields,
        external_id: z
          .string()
          .optional()
          .describe("Tracker ID e.g. WA-012 (preferred)"),
      }),
    },
    async (args) => {
      try {
        if (!args.id && !args.external_id) {
          return errorText("Provide external_id (WA-###) or id");
        }
        const enquiry = await updateWhatsAppEnquiryFromMcp(args);
        return jsonText({ ok: true, enquiry });
      } catch (err) {
        return errorText(err instanceof Error ? err.message : "Update failed");
      }
    }
  );

  server.registerTool(
    "list_enquiries",
    {
      title: "List enquiries",
      description:
        "List Marketing Hub enquiries from web_enquiries + whatsapp_enquiries (one combined Enquiries tab). Filter by intake channel.",
      inputSchema: z.object({
        channel: enquiryChannel
          .optional()
          .describe("web = quote form, whatsapp = WhatsApp tracker"),
        include_test: z.boolean().optional(),
        limit: z.number().int().min(1).max(100).optional(),
      }),
    },
    async (args) => jsonText(await listEnquiriesForMcp(args))
  );
}
