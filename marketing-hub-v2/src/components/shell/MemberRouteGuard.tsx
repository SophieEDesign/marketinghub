"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useHubView } from "@/lib/hub-view";
import { navForView } from "@/lib/nav";

/** Redirect restricted views away from routes they should not see. */
export function MemberRouteGuard({ children }: { children: React.ReactNode }) {
  const { view, ready } = useHubView();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!ready || view === "admin") return;
    const allowed = Array.from(
      new Set(navForView(view).map((n) => n.href))
    );
    const ok = allowed.some((href) =>
      href === "/app"
        ? pathname === "/app"
        : pathname === href || pathname.startsWith(`${href}/`)
    );
    if (!ok) {
      router.replace(view === "external" ? "/app/library" : "/app");
    }
  }, [ready, view, pathname, router]);

  return <>{children}</>;
}
