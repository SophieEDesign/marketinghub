"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Copy, Check, RefreshCw } from "lucide-react"

type PlanableSyncResponse = {
  socialPostsTable: string | null
  socialPostsTableId: string | null
  supabaseUrl: string
  fields: Record<string, string>
  planableApiBaseUrl: string
  makeScenario3: {
    name: string
    trigger: string
    table: string | null
    filter: string
    filterNotes: string[]
    httpPatch: { method: string; urlTemplate: string; note: string }
    afterPatch: { module: string; set: Record<string, string> }
  }
  makeScenario2Poll: { name: string; note: string }
}

function CopyBlock({
  label,
  value,
  mono = true,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (e) {
      console.error("Copy failed:", e)
    }
  }

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex items-start gap-2">
        <pre
          className={`flex-1 rounded-md border bg-muted/40 p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all ${
            mono ? "font-mono" : ""
          }`}
        >
          {value}
        </pre>
        <Button type="button" variant="outline" size="sm" onClick={copy} className="shrink-0">
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 mr-1" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5 mr-1" />
              Copy
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

export default function SettingsPlanableSyncTab() {
  const [data, setData] = useState<PlanableSyncResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/integrations/planable-sync")
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to load")
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load")
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const fieldList = data
    ? Object.entries(data.fields)
        .map(([key, col]) => `${key}: ${col}`)
        .join("\n")
    : ""

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Planable sync (Make.com)</CardTitle>
          <CardDescription>
            Scenario 3 pushes Hub edits to Planable. Store your Planable API token in Make only —
            not in Marketing Hub.
          </CardDescription>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : loading && !data ? (
          <p className="text-sm text-muted-foreground">Loading sync reference…</p>
        ) : data ? (
          <>
            <div className="rounded-lg border p-4 space-y-3 text-sm">
              <p>
                <span className="font-medium">Social Posts table:</span>{" "}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">
                  {data.socialPostsTable || "Not found"}
                </code>
              </p>
              <p className="text-muted-foreground">
                Run migrations <code className="text-xs">20260620150000</code> and{" "}
                <code className="text-xs">20260620160000</code> if these columns are missing.
              </p>
            </div>

            <CopyBlock label="Sync columns" value={fieldList} />

            <div className="space-y-3">
              <h3 className="text-sm font-semibold">{data.makeScenario3.name}</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                <li>
                  <span className="text-foreground">Trigger:</span> {data.makeScenario3.trigger} on{" "}
                  <code className="text-xs">{data.makeScenario3.table}</code>
                </li>
                <li>
                  <span className="text-foreground">Router filter:</span> apply the conditions below
                </li>
                <li>
                  <span className="text-foreground">HTTP:</span> {data.makeScenario3.httpPatch.method}{" "}
                  unpublished post in Planable (Bearer <code className="text-xs">pln_…</code>)
                </li>
                <li>
                  <span className="text-foreground">Supabase update:</span> set{" "}
                  <code className="text-xs">last_synced_at</code> and{" "}
                  <code className="text-xs">sync_source = hub</code>
                </li>
              </ol>
              <CopyBlock label="Make filter (Scenario 3)" value={data.makeScenario3.filter} />
              <ul className="text-xs text-muted-foreground space-y-1">
                {data.makeScenario3.filterNotes.map((note) => (
                  <li key={note}>• {note}</li>
                ))}
              </ul>
              <CopyBlock
                label="Planable PATCH URL template"
                value={data.makeScenario3.httpPatch.urlTemplate}
              />
              <p className="text-xs text-muted-foreground">{data.makeScenario3.httpPatch.note}</p>
              <CopyBlock
                label="After PATCH — Supabase fields to set"
                value={JSON.stringify(data.makeScenario3.afterPatch.set, null, 2)}
              />
            </div>

            <div className="rounded-lg border border-amber-200/80 bg-amber-50/80 dark:bg-amber-950/20 p-4 space-y-2">
              <p className="text-sm font-medium">Loop prevention</p>
              <p className="text-sm text-muted-foreground">{data.makeScenario2Poll.note}</p>
              <p className="text-sm text-muted-foreground">
                Edits in the Hub set <code className="text-xs">sync_source = hub</code> automatically
                so Make knows to push them to Planable.
              </p>
            </div>

            <CopyBlock label="Planable API base URL" value={data.planableApiBaseUrl} />
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}
