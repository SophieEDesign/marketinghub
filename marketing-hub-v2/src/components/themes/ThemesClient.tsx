"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CornerDownRight, Plus } from "lucide-react";
import type {
  ContentStatus,
  QuarterlyTheme,
  ThemeMainContent,
  ThemeOffshoot,
  ThemeStatus,
} from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { ContactOwnerSelect } from "@/components/ui/ContactOwnerSelect";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<ThemeStatus, string> = {
  previous: "Previous",
  active: "Active",
  upcoming: "Upcoming",
};

export function ThemesClient({
  initialThemes,
  initialMains,
  initialOffshoots,
}: {
  initialThemes: QuarterlyTheme[];
  initialMains: ThemeMainContent[];
  initialOffshoots: ThemeOffshoot[];
}) {
  const [themes, setThemes] = useState(initialThemes);
  const [mains, setMains] = useState(initialMains);
  const [offshoots, setOffshoots] = useState(initialOffshoots);
  const [selectedId, setSelectedId] = useState(
    () =>
      initialThemes.find((t) => t.status === "active")?.id ??
      initialThemes[0]?.id ??
      null
  );
  const [mainForm, setMainForm] = useState({ title: "", channel: "", owner: "" });
  const [offshootFor, setOffshootFor] = useState<string | null>(null);
  const [offshootForm, setOffshootForm] = useState({
    title: "",
    channel: "",
    owner: "",
  });

  const refresh = useCallback(async () => {
    const res = await fetch("/api/themes");
    const data = await res.json();
    setThemes(data.themes ?? []);
    setMains(data.mains ?? []);
    setOffshoots(data.offshoots ?? []);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selected = useMemo(
    () => themes.find((t) => t.id === selectedId) ?? null,
    [themes, selectedId]
  );

  const selectedMains = useMemo(
    () => mains.filter((m) => m.theme_id === selectedId),
    [mains, selectedId]
  );

  async function addMain() {
    if (!selectedId || !mainForm.title.trim()) return;
    await fetch("/api/themes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entity: "main",
        theme_id: selectedId,
        ...mainForm,
        status: "idea",
      }),
    });
    setMainForm({ title: "", channel: "", owner: "" });
    await refresh();
  }

  async function addOffshoot(mainId: string) {
    if (!offshootForm.title.trim()) return;
    await fetch("/api/themes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entity: "offshoot",
        main_content_id: mainId,
        ...offshootForm,
        status: "idea",
      }),
    });
    setOffshootForm({ title: "", channel: "", owner: "" });
    setOffshootFor(null);
    await refresh();
  }

  async function setThemeStatus(id: string, status: ThemeStatus) {
    await fetch("/api/themes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update",
        entity: "theme",
        id,
        patch: { status },
      }),
    });
    await refresh();
  }

  async function setItemStatus(
    entity: "main" | "offshoot",
    id: string,
    status: ContentStatus
  ) {
    await fetch("/api/themes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update",
        entity,
        id,
        patch: { status },
      }),
    });
    await refresh();
  }

  async function remove(entity: "main" | "offshoot", id: string) {
    await fetch("/api/themes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", entity, id }),
    });
    await refresh();
  }

  return (
    <div>
      <PageHeader
        title="Quarterly themes"
        description="Theme → main content → offshoot pieces. Plan the quarter’s spine, then branch social and supporting assets."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {themes.map((theme) => {
          const active = theme.id === selectedId;
          const count = mains.filter((m) => m.theme_id === theme.id).length;
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => setSelectedId(theme.id)}
              className={cn(
                "surface-card p-4 text-left transition hover:-translate-y-0.5",
                active && "border-accent ring-2 ring-accent/20"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {theme.quarter} · {theme.year}
                </span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-medium",
                    theme.status === "active"
                      ? "bg-accent-soft text-brand"
                      : "bg-sand text-muted"
                  )}
                >
                  {STATUS_LABEL[theme.status]}
                </span>
              </div>
              <h2 className="mt-2 font-display text-lg text-brand">{theme.title}</h2>
              <p className="mt-1 line-clamp-2 text-xs text-muted">{theme.summary}</p>
              <p className="mt-3 text-xs text-muted">{count} main pieces</p>
            </button>
          );
        })}
      </div>

      {selected ? (
        <div className="space-y-6">
          <div className="surface-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Theme
                </p>
                <h2 className="font-display text-2xl text-brand">
                  {selected.quarter}: {selected.title}
                </h2>
                <p className="mt-1 max-w-2xl text-sm text-muted">{selected.summary}</p>
              </div>
              <select
                className="field w-auto"
                value={selected.status}
                onChange={(e) =>
                  void setThemeStatus(selected.id, e.target.value as ThemeStatus)
                }
              >
                <option value="previous">Previous</option>
                <option value="active">Active</option>
                <option value="upcoming">Upcoming</option>
              </select>
            </div>
          </div>

          <div className="surface-card p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Main content
                </p>
                <h3 className="font-display text-xl text-brand">Core pieces</h3>
              </div>
            </div>

            <div className="mb-4 grid gap-2 md:grid-cols-[1fr_160px_140px_auto]">
              <input
                className="field"
                placeholder="Main content title"
                value={mainForm.title}
                onChange={(e) => setMainForm({ ...mainForm, title: e.target.value })}
              />
              <input
                className="field"
                placeholder="Channel"
                value={mainForm.channel}
                onChange={(e) =>
                  setMainForm({ ...mainForm, channel: e.target.value })
                }
              />
              <ContactOwnerSelect
                className="field"
                value={mainForm.owner}
                onChange={(owner) => setMainForm({ ...mainForm, owner })}
              />
              <button type="button" className="btn-primary" onClick={() => void addMain()}>
                <Plus className="h-4 w-4" />
                Add
              </button>
            </div>

            <div className="space-y-4">
              {selectedMains.map((main) => {
                const kids = offshoots.filter((o) => o.main_content_id === main.id);
                return (
                  <article
                    key={main.id}
                    className="rounded-2xl border border-border bg-sand/40 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{main.title}</p>
                        <p className="text-xs text-muted">
                          {main.channel || "No channel"}
                          {main.owner ? ` · ${main.owner}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          className="field w-auto py-1.5 text-xs"
                          value={main.status}
                          onChange={(e) =>
                            void setItemStatus(
                              "main",
                              main.id,
                              e.target.value as ContentStatus
                            )
                          }
                        >
                          {(
                            [
                              "idea",
                              "draft",
                              "review",
                              "scheduled",
                              "published",
                            ] as ContentStatus[]
                          ).map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="btn-secondary py-1.5 text-xs"
                          onClick={() =>
                            setOffshootFor(offshootFor === main.id ? null : main.id)
                          }
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Offshoot
                        </button>
                        <button
                          type="button"
                          className="text-xs text-[var(--danger)]"
                          onClick={() => void remove("main", main.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {kids.length > 0 ? (
                      <ul className="mt-3 space-y-2 border-l-2 border-accent/40 pl-4">
                        {kids.map((kid) => (
                          <li
                            key={kid.id}
                            className="flex flex-wrap items-start justify-between gap-2 rounded-xl bg-white px-3 py-2"
                          >
                            <div className="flex items-start gap-2">
                              <CornerDownRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" />
                              <div>
                                <p className="text-sm font-medium">{kid.title}</p>
                                <p className="text-xs text-muted">
                                  {kid.channel || "Offshoot"}
                                  {kid.owner ? ` · ${kid.owner}` : ""}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <select
                                className="field w-auto py-1 text-xs"
                                value={kid.status}
                                onChange={(e) =>
                                  void setItemStatus(
                                    "offshoot",
                                    kid.id,
                                    e.target.value as ContentStatus
                                  )
                                }
                              >
                                {(
                                  [
                                    "idea",
                                    "draft",
                                    "review",
                                    "scheduled",
                                    "published",
                                  ] as ContentStatus[]
                                ).map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                className="text-xs text-[var(--danger)]"
                                onClick={() => void remove("offshoot", kid.id)}
                              >
                                Delete
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 text-xs text-muted">
                        No offshoots yet — add social cuts, quotes, or supporting posts.
                      </p>
                    )}

                    {offshootFor === main.id ? (
                      <div className="mt-3 grid gap-2 md:grid-cols-[1fr_140px_120px_auto]">
                        <input
                          className="field"
                          placeholder="Offshoot title"
                          value={offshootForm.title}
                          onChange={(e) =>
                            setOffshootForm({
                              ...offshootForm,
                              title: e.target.value,
                            })
                          }
                        />
                        <input
                          className="field"
                          placeholder="Channel"
                          value={offshootForm.channel}
                          onChange={(e) =>
                            setOffshootForm({
                              ...offshootForm,
                              channel: e.target.value,
                            })
                          }
                        />
                        <ContactOwnerSelect
                          value={offshootForm.owner}
                          onChange={(owner) =>
                            setOffshootForm({
                              ...offshootForm,
                              owner,
                            })
                          }
                        />
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => void addOffshoot(main.id)}
                        >
                          Save
                        </button>
                      </div>
                    ) : null}
                  </article>
                );
              })}

              {selectedMains.length === 0 ? (
                <p className="text-sm text-muted">
                  Add the main content pieces that carry this theme, then branch
                  offshoots underneath.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted">Select a quarter theme to plan content.</p>
      )}
    </div>
  );
}
