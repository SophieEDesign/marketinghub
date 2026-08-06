"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { X } from "lucide-react";
import {
  isTourCompleted,
  markTourCompleted,
  sessionRoleToTourAudience,
  type TourAudience,
} from "@/lib/tour/storage";
import { tourStepsFor, tourWelcomeCopy, type TourStep } from "@/lib/tour/steps";
import { cn } from "@/lib/utils";

type TourContextValue = {
  startTour: () => void;
  audience: TourAudience;
};

const TourContext = createContext<TourContextValue | null>(null);

export function useHubTour() {
  return useContext(TourContext);
}

type Rect = { top: number; left: number; width: number; height: number };

function readRect(el: Element | null): Rect | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 2 && r.height < 2) return null;
  return {
    top: r.top,
    left: r.left,
    width: r.width,
    height: r.height,
  };
}

function pickVisibleElement(selector: string): Element | null {
  const nodes = Array.from(document.querySelectorAll(selector));
  for (const node of nodes) {
    const style = window.getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") continue;
    const r = node.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    return node;
  }
  return nodes[0] ?? null;
}

async function waitForSelector(
  selector: string,
  timeoutMs = 4000
): Promise<Element | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const el = pickVisibleElement(selector);
    if (el) return el;
    await new Promise((r) => setTimeout(r, 50));
  }
  return pickVisibleElement(selector);
}

function pathMatches(pathname: string, href: string) {
  if (href === "/app") return pathname === "/app";
  if (href === "/media") return pathname === "/media" || pathname.startsWith("/media/");
  return pathname === href || pathname.startsWith(`${href}/`);
}

function tooltipPosition(
  rect: Rect,
  placement: TourStep["placement"],
  tipW: number,
  tipH: number
) {
  const gap = 12;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let top = rect.top;
  let left = rect.left;

  const prefer = placement ?? "auto";
  const tryRight = () => {
    left = rect.left + rect.width + gap;
    top = rect.top + rect.height / 2 - tipH / 2;
  };
  const tryLeft = () => {
    left = rect.left - tipW - gap;
    top = rect.top + rect.height / 2 - tipH / 2;
  };
  const tryBottom = () => {
    left = rect.left + rect.width / 2 - tipW / 2;
    top = rect.top + rect.height + gap;
  };
  const tryTop = () => {
    left = rect.left + rect.width / 2 - tipW / 2;
    top = rect.top - tipH - gap;
  };

  if (prefer === "right") tryRight();
  else if (prefer === "left") tryLeft();
  else if (prefer === "bottom") tryBottom();
  else if (prefer === "top") tryTop();
  else {
    // Prefer right of sidebar targets, else bottom
    if (rect.left < 280 && rect.width < 320) tryRight();
    else tryBottom();
  }

  left = Math.max(12, Math.min(left, vw - tipW - 12));
  top = Math.max(12, Math.min(top, vh - tipH - 12));
  return { top, left };
}

type HubTourProps = {
  userKey: string;
  accessRole?: "admin" | "staff" | "media_guest";
  /** Force audience (e.g. media page always external). */
  audience?: TourAudience;
  /** Optional: ensure admin view so all admin nav targets exist. */
  onEnsureAdminView?: () => void;
  /** Current hub UI view — admin tour waits until this is "admin". */
  hubView?: "admin" | "member" | "external";
  /** Open mobile nav when targeting sidebar links on small screens. */
  onOpenMobileNav?: () => void;
  className?: string;
};

export function HubTourProvider({
  children,
  userKey,
  accessRole,
  audience: audienceProp,
  onEnsureAdminView,
  hubView,
  onOpenMobileNav,
}: HubTourProps & { children: React.ReactNode }) {
  const audience =
    audienceProp ?? sessionRoleToTourAudience(accessRole);
  const router = useRouter();
  const pathname = usePathname();
  const [phase, setPhase] = useState<"idle" | "welcome" | "running">("idle");
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [dontShowAgain, setDontShowAgain] = useState(true);
  const tipRef = useRef<HTMLDivElement>(null);
  const [tipSize, setTipSize] = useState({ w: 320, h: 160 });
  const steps = useMemo(() => tourStepsFor(audience), [audience]);
  const welcome = useMemo(() => tourWelcomeCopy(audience), [audience]);
  const runningRef = useRef(false);
  const pendingRunRef = useRef(false);

  const finish = useCallback(
    (persist: boolean) => {
      runningRef.current = false;
      pendingRunRef.current = false;
      setPhase("idle");
      setStepIndex(0);
      setRect(null);
      if (persist) markTourCompleted(audience, userKey);
    },
    [audience, userKey]
  );

  const startTour = useCallback(() => {
    if (audience === "admin") onEnsureAdminView?.();
    setDontShowAgain(true);
    setStepIndex(0);
    setPhase("welcome");
  }, [audience, onEnsureAdminView]);

  // Auto-offer on first load if not completed
  useEffect(() => {
    if (!userKey) return;
    if (isTourCompleted(audience, userKey)) return;
    const t = window.setTimeout(() => {
      if (!runningRef.current && phase === "idle") {
        if (audience === "admin") onEnsureAdminView?.();
        setPhase("welcome");
      }
    }, 700);
    return () => window.clearTimeout(t);
    // only on mount / identity change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audience, userKey]);

  // When running, keep highlight aligned (resize / route)
  useEffect(() => {
    if (phase !== "running") return;
    const step = steps[stepIndex];
    if (!step) return;
    let cancelled = false;

    async function align() {
      if (cancelled) return;
      if (step.href && !pathMatches(pathname, step.href)) {
        router.push(step.href);
        return;
      }
      if (window.innerWidth < 768) {
        if (
          step.selector.includes("data-tour=\"nav-") ||
          step.selector.includes("sidebar") ||
          step.selector.includes("view-toggle") ||
          step.selector.includes("account-menu")
        ) {
          onOpenMobileNav?.();
        }
      }
      const el = await waitForSelector(step.selector);
      if (cancelled) return;
      el?.scrollIntoView({ block: "nearest", inline: "nearest" });
      setRect(readRect(el));
    }

    void align();

    const onResize = () => {
      const el = pickVisibleElement(step.selector);
      setRect(readRect(el));
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [phase, stepIndex, steps, pathname, router, onOpenMobileNav]);

  useEffect(() => {
    if (phase !== "running" || !tipRef.current) return;
    const r = tipRef.current.getBoundingClientRect();
    setTipSize({ w: r.width, h: r.height });
  }, [phase, stepIndex, rect]);

  const beginSteps = () => {
    runningRef.current = true;
    if (audience === "admin") {
      onEnsureAdminView?.();
      if (hubView && hubView !== "admin") {
        pendingRunRef.current = true;
        return;
      }
    }
    pendingRunRef.current = false;
    setStepIndex(0);
    setPhase("running");
  };

  // Wait for Admin view before highlighting admin-only nav items
  useEffect(() => {
    if (!pendingRunRef.current) return;
    if (audience !== "admin") return;
    if (hubView !== "admin") {
      onEnsureAdminView?.();
      return;
    }
    pendingRunRef.current = false;
    setStepIndex(0);
    setPhase("running");
  }, [hubView, audience, onEnsureAdminView]);

  const goNext = () => {
    if (audience === "admin") onEnsureAdminView?.();
    if (stepIndex >= steps.length - 1) {
      finish(dontShowAgain);
      return;
    }
    setStepIndex((i) => i + 1);
  };

  const goBack = () => {
    if (stepIndex <= 0) {
      setPhase("welcome");
      setRect(null);
      return;
    }
    setStepIndex((i) => i - 1);
  };

  const skip = () => finish(dontShowAgain);

  const ctx = useMemo(
    () => ({ startTour, audience }),
    [startTour, audience]
  );

  const step = steps[stepIndex];
  const tipPos =
    rect && phase === "running"
      ? tooltipPosition(rect, step?.placement, tipSize.w, tipSize.h)
      : null;

  const pad = 8;

  return (
    <TourContext.Provider value={ctx}>
      {children}

      {phase === "welcome" ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="hub-tour-welcome-title"
        >
          <div className="surface-card w-full max-w-md p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-accent">
                  Getting started
                </p>
                <h2
                  id="hub-tour-welcome-title"
                  className="mt-1 font-display text-2xl text-brand"
                >
                  {welcome.title}
                </h2>
              </div>
              <button
                type="button"
                className="rounded-lg p-1.5 text-muted hover:bg-sand hover:text-foreground"
                aria-label="Close"
                onClick={skip}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-3 text-sm text-muted">{welcome.body}</p>
            <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                className="accent-[var(--brand)]"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
              />
              Don&apos;t show this again
            </label>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={skip}>
                Skip
              </button>
              <button type="button" className="btn-primary" onClick={beginSteps}>
                Start tour
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {phase === "running" && step ? (
        <div className="fixed inset-0 z-[100]" aria-live="polite">
          {/* Dim overlay with spotlight hole */}
          <div
            className="pointer-events-auto absolute inset-0"
            onClick={skip}
            aria-hidden
          >
            {rect ? (
              <div
                className="absolute rounded-xl ring-2 ring-accent transition-all duration-200"
                style={{
                  top: rect.top - pad,
                  left: rect.left - pad,
                  width: rect.width + pad * 2,
                  height: rect.height + pad * 2,
                  boxShadow: "0 0 0 9999px rgba(15, 28, 36, 0.55)",
                }}
              />
            ) : (
              <div className="absolute inset-0 bg-black/45" />
            )}
          </div>

          <div
            ref={tipRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="hub-tour-step-title"
            className={cn(
              "pointer-events-auto absolute z-[101] w-[min(100vw-1.5rem,20rem)] rounded-2xl border border-border bg-white p-4 shadow-xl",
              !tipPos && "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            )}
            style={
              tipPos
                ? { top: tipPos.top, left: tipPos.left }
                : undefined
            }
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] font-medium text-muted">
                  {stepIndex + 1} of {steps.length}
                </p>
                <h3
                  id="hub-tour-step-title"
                  className="mt-0.5 font-display text-lg text-brand"
                >
                  {step.title}
                </h3>
              </div>
              <button
                type="button"
                className="rounded-lg p-1 text-muted hover:bg-sand hover:text-foreground"
                aria-label="Close tour"
                onClick={skip}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-sm text-muted">{step.body}</p>
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                className="accent-[var(--brand)]"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
              />
              Don&apos;t show again when finished
            </label>
            <div className="mt-4 flex items-center justify-between gap-2">
              <button type="button" className="btn-ghost !px-2 !py-1.5 text-xs" onClick={skip}>
                Skip tour
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-secondary !px-3 !py-1.5 text-xs"
                  onClick={goBack}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="btn-primary !px-3 !py-1.5 text-xs"
                  onClick={goNext}
                >
                  {stepIndex >= steps.length - 1 ? "Done" : "Next"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </TourContext.Provider>
  );
}

/** @deprecated use HubTourProvider — kept name alias for clarity at call sites */
export const HubTour = HubTourProvider;
