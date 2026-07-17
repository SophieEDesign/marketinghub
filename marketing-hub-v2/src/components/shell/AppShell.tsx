"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Database, Menu, X } from "lucide-react";
import { navForView } from "@/lib/nav";
import { HubViewProvider, useHubView } from "@/lib/hub-view";
import { MemberRouteGuard } from "@/components/shell/MemberRouteGuard";
import { cn } from "@/lib/utils";

function ViewToggle() {
  const { view, setView, ready } = useHubView();
  if (!ready) {
    return <div className="h-9 rounded-xl bg-sand/80" aria-hidden />;
  }

  return (
    <div
      className="inline-flex w-full rounded-xl border border-border bg-sand/60 p-1"
      role="group"
      aria-label="Hub view"
    >
      <button
        type="button"
        className={cn(
          "flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition",
          view === "member"
            ? "bg-white text-brand shadow-sm"
            : "text-muted hover:text-foreground"
        )}
        onClick={() => setView("member")}
      >
        Member
      </button>
      <button
        type="button"
        className={cn(
          "flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition",
          view === "admin"
            ? "bg-white text-brand shadow-sm"
            : "text-muted hover:text-foreground"
        )}
        onClick={() => setView("admin")}
      >
        Admin
      </button>
    </div>
  );
}

function ShellInner({
  children,
  userName,
}: {
  children: React.ReactNode;
  userName: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { view } = useHubView();
  const nav = navForView(view);

  const Nav = (
    <nav className="flex flex-col gap-1 p-3">
      {nav.map((item) => {
        const active =
          item.href === "/app"
            ? pathname === "/app"
            : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
              active
                ? "bg-accent-soft text-brand font-medium"
                : "text-muted hover:bg-sand hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen md:flex">
      <aside className="hidden w-64 shrink-0 border-r border-border bg-white/80 backdrop-blur md:flex md:flex-col">
        <div className="border-b border-border px-5 py-5">
          <p className="font-display text-lg tracking-tight text-brand">
            Peters &amp; May
          </p>
          <p className="text-xs text-muted">Marketing Hub</p>
          <div className="mt-4">
            <ViewToggle />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">{Nav}</div>
        <div className="border-t border-border px-5 py-4 text-xs text-muted">
          <p>Signed in as {userName}</p>
          <p className="mt-1 capitalize text-[11px]">{view} view</p>
          {view === "admin" ? (
            <Link
              href="/app/data"
              className={cn(
                "mt-3 inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] font-medium transition",
                pathname.startsWith("/app/data")
                  ? "bg-accent-soft text-brand"
                  : "text-muted hover:bg-sand hover:text-foreground"
              )}
            >
              <Database className="h-3.5 w-3.5" />
              Data tables
            </Link>
          ) : null}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-white/90 px-4 py-3 backdrop-blur md:hidden">
          <div className="min-w-0">
            <p className="font-display text-base text-brand">Peters &amp; May</p>
            <p className="text-xs text-muted">Marketing Hub</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-36">
              <ViewToggle />
            </div>
            <button
              type="button"
              className="btn-secondary px-3 py-2"
              onClick={() => setOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </header>

        {open && (
          <div className="border-b border-border bg-white md:hidden">{Nav}</div>
        )}

        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
          <MemberRouteGuard>{children}</MemberRouteGuard>
        </main>
      </div>
    </div>
  );
}

export function AppShell({
  children,
  userName,
}: {
  children: React.ReactNode;
  userName: string;
}) {
  return (
    <HubViewProvider>
      <ShellInner userName={userName}>{children}</ShellInner>
    </HubViewProvider>
  );
}
