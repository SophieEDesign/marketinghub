import type { TourAudience } from "@/lib/tour/storage";

export type TourStep = {
  id: string;
  /** CSS selector — prefer [data-tour="…"] */
  selector: string;
  title: string;
  body: string;
  /** Navigate here before highlighting (optional). */
  href?: string;
  /** Prefer desktop sidebar target; falls back to mobile. */
  placement?: "auto" | "right" | "left" | "top" | "bottom";
};

const WELCOME_SIDEBAR: TourStep = {
  id: "sidebar",
  selector: '[data-tour="sidebar"]',
  title: "Welcome to Marketing Hub",
  body: "Use the left menu to move around. We’ll walk through the main areas — each step opens the real page.",
  href: "/app",
  placement: "right",
};

const ACCOUNT_STEP: TourStep = {
  id: "account",
  selector: '[data-tour="account-menu"]',
  title: "Your account",
  body: "Open this menu for My details (your contact card) and Sign out. You can replay this tour from here anytime.",
  placement: "right",
};

export const MEMBER_TOUR_STEPS: TourStep[] = [
  WELCOME_SIDEBAR,
  {
    id: "home",
    selector: '[data-tour="nav-home"]',
    title: "Home",
    body: "Your overview — shortcuts into the areas you use day to day.",
    href: "/app",
    placement: "right",
  },
  {
    id: "events",
    selector: '[data-tour="nav-events"]',
    title: "Events",
    body: "Shows, meetings, and ceremonies. Open an event to see details and linked work.",
    href: "/app/events",
    placement: "right",
  },
  {
    id: "content",
    selector: '[data-tour="nav-content"]',
    title: "Content & Social",
    body: "The social calendar — what’s scheduled and what’s already published.",
    href: "/app/content",
    placement: "right",
  },
  {
    id: "partners",
    selector: '[data-tour="nav-partners"]',
    title: "Partners",
    body: "Sponsorships and industry memberships. Members can add and manage their memberships.",
    href: "/app/partners",
    placement: "right",
  },
  {
    id: "awards",
    selector: '[data-tour="nav-awards"]',
    title: "Awards",
    body: "Track awards you’re watching, entering, shortlisted for, or have won.",
    href: "/app/awards",
    placement: "right",
  },
  {
    id: "library",
    selector: '[data-tour="nav-library"]',
    title: "Library",
    body: "Brand assets, media, guidelines, and useful links — shared with the wider team.",
    href: "/app/library",
    placement: "right",
  },
  {
    id: "requests",
    selector: '[data-tour="nav-requests"]',
    title: "Requests",
    body: "Clothes, merch, asset asks, and staff social forms live here.",
    href: "/app/requests",
    placement: "right",
  },
  {
    id: "enquiries",
    selector: '[data-tour="nav-enquiries"]',
    title: "Web Enquiries",
    body: "Quote requests from the website land here for the team to follow up.",
    href: "/app/enquiries",
    placement: "right",
  },
  ACCOUNT_STEP,
];

export const ADMIN_TOUR_STEPS: TourStep[] = [
  WELCOME_SIDEBAR,
  {
    id: "view-toggle",
    selector: '[data-tour="view-toggle"]',
    title: "View modes",
    body: "Switch between Admin, Member, and External to preview what each audience sees. Your real access stays Admin.",
    href: "/app",
    placement: "right",
  },
  {
    id: "home",
    selector: '[data-tour="nav-home"]',
    title: "Home",
    body: "Hub overview for the marketing team.",
    href: "/app",
    placement: "right",
  },
  {
    id: "events",
    selector: '[data-tour="nav-events"]',
    title: "Events",
    body: "Manage shows, meetings, and ceremonies.",
    href: "/app/events",
    placement: "right",
  },
  {
    id: "content",
    selector: '[data-tour="nav-content"]',
    title: "Content & Social",
    body: "Full content pipeline and social calendar — more detail than Member view.",
    href: "/app/content",
    placement: "right",
  },
  {
    id: "tasks",
    selector: '[data-tour="nav-tasks"]',
    title: "Tasks",
    body: "Marketing to-dos with owners, deadlines, and status — Admin only.",
    href: "/app/tasks",
    placement: "right",
  },
  {
    id: "partners",
    selector: '[data-tour="nav-partners"]',
    title: "Partners",
    body: "Sponsorships and memberships. Admins can manage everything here.",
    href: "/app/partners",
    placement: "right",
  },
  {
    id: "awards",
    selector: '[data-tour="nav-awards"]',
    title: "Awards",
    body: "Industry awards tracking across the pipeline.",
    href: "/app/awards",
    placement: "right",
  },
  {
    id: "library",
    selector: '[data-tour="nav-library"]',
    title: "Library",
    body: "Media library and brand resources. External guests only see the public media side.",
    href: "/app/library",
    placement: "right",
  },
  {
    id: "themes",
    selector: '[data-tour="nav-themes"]',
    title: "Themes",
    body: "Quarterly themes → main pieces → offshoots. Admin planning view.",
    href: "/app/themes",
    placement: "right",
  },
  {
    id: "requests",
    selector: '[data-tour="nav-requests"]',
    title: "Requests",
    body: "Incoming clothes, merch, asset, and social requests.",
    href: "/app/requests",
    placement: "right",
  },
  {
    id: "enquiries",
    selector: '[data-tour="nav-enquiries"]',
    title: "Web Enquiries",
    body: "Website quote form submissions for follow-up.",
    href: "/app/enquiries",
    placement: "right",
  },
  {
    id: "reports",
    selector: '[data-tour="nav-reports"]',
    title: "Reporting",
    body: "Analytics, ads, SEO, and Looker Studio links — Admin only.",
    href: "/app/reports",
    placement: "right",
  },
  {
    id: "contacts",
    selector: '[data-tour="nav-contacts"]',
    title: "Contacts",
    body: "Press, partners, and venues in one place.",
    href: "/app/contacts",
    placement: "right",
  },
  {
    id: "admin",
    selector: '[data-tour="nav-admin"]',
    title: "Admin",
    body: "Invite users, set Admin / Member / External roles, and manage data tables.",
    href: "/app/admin",
    placement: "right",
  },
  ACCOUNT_STEP,
];

export const EXTERNAL_TOUR_STEPS: TourStep[] = [
  {
    id: "media-header",
    selector: '[data-tour="media-header"]',
    title: "Media gallery",
    body: "Browse logos, presentations, and gallery images. You can view freely — downloads need a signed-in guest account.",
    href: "/media",
    placement: "bottom",
  },
  {
    id: "media-gallery",
    selector: '[data-tour="media-gallery"]',
    title: "Browse folders",
    body: "Open categories and folders to find the assets you need. Click an item for a larger preview.",
    href: "/media",
    placement: "top",
  },
  {
    id: "media-download",
    selector: '[data-tour="media-auth"]',
    title: "Downloads",
    body: "Use Sign in to download when you’re ready to save files. Staff use Staff login for the full Marketing Hub.",
    href: "/media",
    placement: "bottom",
  },
];

export function tourStepsFor(audience: TourAudience): TourStep[] {
  if (audience === "admin") return ADMIN_TOUR_STEPS;
  if (audience === "external") return EXTERNAL_TOUR_STEPS;
  return MEMBER_TOUR_STEPS;
}

export function tourWelcomeCopy(audience: TourAudience): {
  title: string;
  body: string;
} {
  if (audience === "admin") {
    return {
      title: "Quick admin tour",
      body: "A short walkthrough of Admin tools and menus. We’ll open each section as we go — about a minute.",
    };
  }
  if (audience === "external") {
    return {
      title: "Welcome to the media gallery",
      body: "A quick look at how to browse and download brand assets. You can skip anytime.",
    };
  }
  return {
    title: "Welcome to Marketing Hub",
    body: "A short tour of the menus you’ll use most. We’ll open each page as we go — skip anytime, or tick Don’t show again.",
  };
}
