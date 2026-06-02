import type { TableField } from "@/types/fields"

export type RecordLayoutType =
  | "social_post"
  | "event"
  | "task"
  | "campaign"
  | "asset"
  | "content"
  | "generic"

export interface RecordLayoutSectionPreset {
  id: string
  label: string
  collapsedByDefault?: boolean
  aliases: string[]
}

export interface RecordLayoutPreset {
  sections: RecordLayoutSectionPreset[]
  priorityAliases: string[]
  titleAliases: string[]
  statusAliases: string[]
  mediaPreviewAliases?: string[]
}

const sharedTitleAliases = ["title", "name", "event name", "campaign name", "content name"]
const sharedStatusAliases = ["status", "approval status", "post approval", "stage"]

function aliases(values: string[]): string[] {
  return values.map((value) => value.trim().toLowerCase())
}

export const RECORD_LAYOUT_PRESETS: Record<Exclude<RecordLayoutType, "generic">, RecordLayoutPreset> = {
  social_post: {
    priorityAliases: aliases([
      "content name",
      "title",
      "name",
      "content type",
      "status",
      "date",
      "publish date",
      "platform",
      "channel",
      "campaign",
      "category",
      "theme",
      "owner",
      "assignee",
      "image",
      "media",
      "caption",
      "content",
      "approval",
      "approval status",
    ]),
    titleAliases: aliases(["content name", "title", "name", "content title"]),
    statusAliases: aliases(sharedStatusAliases),
    mediaPreviewAliases: aliases(["image", "media", "thumbnail", "file url", "url"]),
    sections: [
      {
        id: "overview",
        label: "Overview",
        aliases: aliases([
          "content name",
          "title",
          "name",
          "content type",
          "status",
          "date",
          "publish date",
          "scheduled",
          "platform",
          "channel",
          "campaign",
          "category",
          "theme",
          "owner",
          "assignee",
          "approval status",
          "post approval",
        ]),
      },
      {
        id: "caption",
        label: "Caption",
        aliases: aliases([
          "caption",
          "content",
          "post text",
          "copy",
          "hashtag",
          "hashtags",
          "body text",
        ]),
      },
      {
        id: "media",
        label: "Media",
        aliases: aliases(["image", "media", "thumbnail", "file", "asset", "attachment", "gallery", "video"]),
      },
      {
        id: "approval",
        label: "Approval",
        aliases: aliases([
          "approval",
          "approval status",
          "post approval",
          "review",
          "reviewer",
          "approved",
          "approved by",
          "approval date",
          "approval notes",
        ]),
      },
      {
        id: "channels",
        label: "Channels",
        aliases: aliases([
          "channel",
          "platform",
          "instagram",
          "linkedin",
          "facebook",
          "tiktok",
          "youtube",
          "twitter",
          "website",
          "publish",
          "publishing",
          "distribution",
        ]),
      },
      {
        id: "event_links",
        label: "Event links",
        collapsedByDefault: true,
        aliases: aliases(["event", "events", "linked event", "event name", "event date"]),
      },
    ],
  },
  event: {
    priorityAliases: aliases([
      "event name",
      "event type",
      "status",
      "visibility",
      "start date",
      "end date",
      "location",
      "venue",
      "country",
      "attending",
      "attendees",
      "campaign",
      "resources",
      "notes",
    ]),
    titleAliases: aliases(["event name", "title", "name"]),
    statusAliases: aliases(["status", "visibility"]),
    sections: [
      { id: "event_summary", label: "Event summary", aliases: aliases(["event name", "title", "event type", "status"]) },
      { id: "date_location", label: "Date & location", aliases: aliases(["start date", "end date", "date", "location", "venue", "country", "city"]) },
      { id: "attendance", label: "Attendance", aliases: aliases(["attending", "attendees", "attendance", "rsvp"]) },
      { id: "campaign_resources", label: "Campaign / resources", aliases: aliases(["campaign", "resource", "resources", "linked campaign"]) },
      { id: "visibility_publishing", label: "Visibility / publishing", aliases: aliases(["visibility", "publish", "published", "public", "internal"]) },
      { id: "internal_notes", label: "Internal notes", aliases: aliases(["notes", "internal note", "description"]) },
    ],
  },
  task: {
    priorityAliases: aliases([
      "title",
      "type",
      "status",
      "priority",
      "due date",
      "owner",
      "reviewer",
      "campaign",
      "content",
      "event",
      "resource",
      "checklist",
      "notes",
    ]),
    titleAliases: aliases(["title", "task", "name"]),
    statusAliases: aliases(["status", "priority"]),
    sections: [
      { id: "task_summary", label: "Task summary", aliases: aliases(["title", "type", "status", "priority"]) },
      { id: "ownership_dates", label: "Ownership & dates", aliases: aliases(["owner", "reviewer", "due date", "date", "assignee"]) },
      { id: "linked_records", label: "Linked records", aliases: aliases(["campaign", "content", "event", "resource", "linked"]) },
      { id: "checklist", label: "Checklist", aliases: aliases(["checklist", "todo"]) },
      { id: "notes", label: "Notes", aliases: aliases(["notes", "note", "description"]) },
    ],
  },
  campaign: {
    priorityAliases: aliases([
      "campaign name",
      "campaign type",
      "division",
      "status",
      "priority",
      "stage",
      "owner",
      "start date",
      "end date",
      "objective",
      "key message",
      "events",
      "content",
      "tasks",
      "target audience",
      "boats",
      "teams",
    ]),
    titleAliases: aliases(["campaign name", "title", "name"]),
    statusAliases: aliases(["status", "priority", "stage"]),
    sections: [
      { id: "campaign_summary", label: "Campaign summary", aliases: aliases(["campaign name", "title", "name", "campaign type", "division", "status", "priority"]) },
      { id: "strategy", label: "Strategy", aliases: aliases(["objective", "key message", "strategy"]) },
      { id: "dates_stage", label: "Dates & stage", aliases: aliases(["start date", "end date", "date", "stage"]) },
      { id: "linked_work", label: "Linked work", aliases: aliases(["event", "events", "content", "task", "tasks", "linked"]) },
      { id: "target_audience", label: "Target audience / boats & teams", aliases: aliases(["target audience", "boats", "teams", "target"]) },
      { id: "notes", label: "Notes", aliases: aliases(["notes", "note", "description"]) },
    ],
  },
  asset: {
    priorityAliases: aliases([
      "title",
      "category",
      "file type",
      "file url",
      "thumbnail",
      "preview",
      "description",
      "usage",
      "tags",
      "uploaded by",
      "updated date",
      "linked",
    ]),
    titleAliases: aliases(["title", "name"]),
    statusAliases: aliases(["status", "category"]),
    mediaPreviewAliases: aliases(["thumbnail", "preview", "image", "file url", "url"]),
    sections: [
      { id: "asset_preview", label: "Asset preview", aliases: aliases(["thumbnail", "preview", "image", "file url", "url"]) },
      { id: "asset_details", label: "Asset details", aliases: aliases(["title", "category", "file type", "description", "uploaded", "updated"]) },
      { id: "usage", label: "Usage", aliases: aliases(["usage", "license", "guideline"]) },
      { id: "tags", label: "Tags", aliases: aliases(["tag", "tags", "keyword"]) },
      { id: "linked_records", label: "Linked records", aliases: aliases(["linked", "campaign", "event", "content", "task"]) },
    ],
  },
  content: {
    priorityAliases: aliases([
      "title",
      "name",
      "status",
      "publish date",
      "date",
      "channel",
      "platform",
      "content type",
      "campaign",
      "theme",
      "media",
      "image",
      "caption",
      "content",
      "notes",
    ]),
    titleAliases: aliases(sharedTitleAliases),
    statusAliases: aliases(sharedStatusAliases),
    mediaPreviewAliases: aliases(["image", "media", "thumbnail", "url"]),
    sections: [
      { id: "content_summary", label: "Content summary", aliases: aliases(["title", "name", "content type"]) },
      { id: "schedule_status", label: "Schedule / status", aliases: aliases(["status", "publish date", "date", "scheduled"]) },
      { id: "campaign_links", label: "Campaign links", aliases: aliases(["campaign", "theme", "linked"]) },
      { id: "distribution_media", label: "Distribution / media", aliases: aliases(["channel", "platform", "media", "image", "caption", "content"]) },
      { id: "notes", label: "Notes", aliases: aliases(["notes", "note", "description"]) },
    ],
  },
}

export function normalizeFieldTokens(field: TableField): string[] {
  const tokens = [
    field.name,
    field.id,
    field.label,
    (field as any).slug,
    (field as any).key,
    (field as any).display_name,
  ]
  return tokens
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim().toLowerCase())
}
