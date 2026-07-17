"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useHubView } from "@/lib/hub-view";
import { navForView } from "@/lib/nav";

/** Redirect members away from admin-only routes if they hit a bookmark/URL. */
export function MemberRouteGuard({ children }: { children: React.ReactNode }) {
  const { view, ready } = useHubView();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!ready || view !== "member") return;
    const allowed = Array.from(
      new Set(navForView("member").map((n) => n.href))
    );
    const ok = allowed.some((href) =>
      href === "/app" ? pathname === "/app" : pathname === href || pathname.startsWith(`${href}/`)
    );
    if (!ok) router.replace("/app");
  }, [ready, view, pathname, router]);

  return <>{children}</>;
}
