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
}
