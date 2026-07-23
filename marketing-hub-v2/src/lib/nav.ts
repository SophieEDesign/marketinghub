import type { LucideIcon } from "lucide-react";
import {
  Award,
  BarChart3,
  CalendarDays,
  CheckSquare,
  Clapperboard,
  Contact,
  Handshake,
  Home,
  Inbox,
  Library,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";

export type HubViewMode = "admin" | "member" | "external";

export type NavItem = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Shown in member (daily) view when true; admin always sees all. */
  member?: boolean;
  /** Shown in external (media guest) preview when true. */
  external?: boolean;
};

export const STAFF_NAV: NavItem[] = [
  {
    href: "/app",
    label: "Home",
    description: "Overview of marketing activity",
    icon: Home,
    member: true,
  },
  {
    href: "/app/events",
    label: "Events",
    description: "Shows, meetings, and ceremonies",
    icon: CalendarDays,
    member: true,
  },
  {
    href: "/app/content",
    label: "Content & Social",
    description: "Social calendar (scheduled & published) — full pipeline in Admin view",
    icon: Clapperboard,
    member: true,
  },
  {
    href: "/app/tasks",
    label: "Tasks",
    description: "Marketing to-dos — From, Deadline, status (admin only)",
    icon: CheckSquare,
  },
  {
    href: "/app/partners",
    label: "Partners",
    description: "Sponsorships and industry memberships",
    icon: Handshake,
    member: true,
  },
  {
    href: "/app/awards",
    label: "Awards",
    description: "Industry awards — watching, entering, shortlisted, won",
    icon: Award,
    member: true,
  },
  {
    href: "/app/library",
    label: "Library",
    description: "Media, brand guidelines, and resource links",
    icon: Library,
    member: true,
    external: true,
  },
  {
    href: "/app/themes",
    label: "Themes",
    description: "Quarterly theme → main → offshoot content",
    icon: Sparkles,
  },
  {
    href: "/app/requests",
    label: "Requests",
    description: "Clothes, merch, asset asks, and staff social forms",
    icon: Users,
    member: true,
  },
  {
    href: "/app/enquiries",
    label: "Web Enquiries",
    description: "Website quote form submissions",
    icon: Inbox,
    member: true,
  },
  {
    href: "/app/reports",
    label: "Reporting",
    description: "Analytics, ads, SEO, Looker Studio links",
    icon: BarChart3,
  },
  {
    href: "/app/contacts",
    label: "Contacts",
    description: "Press, partners, and venues",
    icon: Contact,
  },
  {
    href: "/app/admin",
    label: "Admin",
    description: "Users and data tables",
    icon: Settings,
  },
];

export function navForView(view: HubViewMode): NavItem[] {
  if (view === "admin") return STAFF_NAV;
  if (view === "external") return STAFF_NAV.filter((item) => item.external);
  return STAFF_NAV.filter((item) => item.member);
}
