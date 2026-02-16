# Interface Architecture Refactor Plan

**Created:** February 16, 2026  
**Source:** Full Interface Architecture Audit + Single Right-Side Record Panel simplification

This document combines the audit findings with the structural refactor to a single record panel architecture.

---

## Part A — Full Interface Architecture Audit (Summary)

See the audit output for: Provider dependency map, Navigation stability report, Block render stability report, Record system duplication report, Inspector lifecycle report, Effect risk list, Render cascade map.

**Key findings:**
- RecordModal + RecordPanel + RecordDetailPanelInline create duplicate orchestration
- queueMicrotask used to mask cascading context updates
- setRightPanelData used for record editing (RightSettingsPanel + record layout)
- UIModeContext and SidebarModeContext recreate context values every render
- InterfacePageClient has conditional render trees causing remounts
- Link fallback forces full reload after 100ms

---

## Part B — Build Plan: Execution Blueprint

We are not rewriting the app. We are removing instability layer by layer.

### Priority 1 — Stop Hidden Render Cascades

These are your silent killers.

1. **Stabilise UIModeContext & SidebarModeContext**

   **Problem:** Context value recreated every render → all consumers re-render.

   **Fix:** Wrap context values in useMemo.
   ```ts
   const value = useMemo(() => ({
     uiMode,
     setUiMode,
     editingPageId
   }), [uiMode, editingPageId])
   ```
   Do the same for SidebarMode. This alone reduces background noise across the whole app.

2. **Fix RightPanel Sync Effect (Big One)**

   **Problem:** InterfacePageClient effect:
   ```ts
   useEffect(() => {
     setRightPanelData(...)
   }, [handlePageUpdate])
   ```
   And handlePageUpdate depends on page values. So: page loads → handlePageUpdate changes → effect runs → setRightPanelData triggers render → handlePageUpdate changes again → ghost refreshes.

   **Correct Fix (Strict Version):** Remove handlePageUpdate from deps. Instead:
   ```ts
   const handlePageUpdateRef = useRef(handlePageUpdate)
   useEffect(() => {
     handlePageUpdateRef.current = handlePageUpdate
   }, [handlePageUpdate])
   ```
   Then remove it from the sync effect dependency list.

   RightPanel sync should depend only on: `page.id`, `blocks` reference, `selectedContext`. Nothing else.

---

### Priority 2 — Unify Record Open Flow

You identified duplication correctly. Currently: RecordModal, RecordPanel, RecordReviewPage all do `setSelectedContext` + `setRightPanelData` in different ways. This is architectural leakage.

**Strict Rule:** Create ONE function:
```ts
openRecordSurface({ recordId, tableId })
```
Inside it:
- `setSelectedContext({ type: "record", id: recordId })`
- `setRecordPanelState(...)`

That's it. Inspector reads selection. It is not pushed record data.

Delete all `setRightPanelData` inside record open flows. RightPanel should derive its data from: selection, page state, block config. Not be fed data.

---

### Priority 3 — Remove Conditional Tree Branching

You currently have:
```ts
if (loading && !page)
if (!page)
if (page)
```
This changes the component tree. That causes: effect re-runs, provider behaviour changes, weird navigation resets.

**Correct Structure:** Always render the same tree:
```tsx
<PageShell>
  {loading && <Overlay />}
  <InterfaceBuilder />
</PageShell>
```
No tree swapping.

---

### Priority 4 — Memoise cascadeContext Everywhere

This one is subtle but real. You found:
```tsx
cascadeContext={{ blockConfig }}
```
This is unstable. Replace with:
```tsx
const cascadeContext = useMemo(() => ({
  blockConfig
}), [blockConfig])
```
Pass that. This prevents Calendar / Grid subtle re-renders.

---

### Priority 5 — FilterStateProvider Placement

Currently remounts per page. You have two options:

- **Option A (Cleaner):** Lift it above InterfaceBuilder so it survives navigation.
- **Option B (Acceptable):** Leave it per-page but ensure: FilterBlocks re-register on mount, no effects depend on previous Map references.

Either is fine — but it must be intentional.

---

### Priority 6 — Remove Link Fallback Hack

The 100ms full reload fallback is hiding a bug. Root suspects: drag overlay blocking clicks, isDraggingRef logic, pathname mismatch.

Fix root cause. Delete `window.location.href = ...`. That is an escape hatch, not architecture.

---

### Priority 7 — RecordPanel Key Audit

```tsx
key={`record-panel-${state.recordId}-${interfaceMode}`}
```
This forces remount on record change. Ask: Do we want remount? If yes → keep. If no → remove interfaceMode from key. Do not accidentally reset panel internal state unless intentional.

---

### Big Picture Stability State

After those fixes you will have:

- No context recreation storms
- No right panel sync loops
- No cascadeContext instability
- No record open duplication
- No tree remount navigation glitching
- No queueMicrotask masking systemic flaws

### Final System Shape

```
WorkspaceShell
  ├─ SelectionContext
  ├─ RecordPanelContext
  ├─ Inspector
  └─ InterfacePageClient
        └─ InterfaceBuilder
              └─ Canvas
                    └─ Blocks
```

RecordEditor exists only inside RecordPanel. Inspector never receives pushed record data. Blocks never fetch or save records. Providers never update during render. Effects never "sync" domains.

### What This Achieves

- React #185 disappears permanently
- Calendar stability holds
- Navigation becomes reliable
- Inspector stops flickering
- Performance improves
- Mental model simplifies

You move from reactive patching → deterministic system.

---

## Part C — Simplify to Single Right-Side Record Panel Architecture

We are simplifying the record system.

The application must use **one single right-side record panel only**.

- No modal-based record editing
- No duplicate orchestration
- No cross-context syncing

This is an architectural refactor, not a feature change.

### Goal

Implement a single unified record editing surface:

- Right-side slide-out RecordPanel
- One `openRecord()` orchestration path
- No RecordModal
- No queueMicrotask hacks
- No setRightPanelData usage for record editing
- No record syncing effects in InterfacePageClient or RecordReviewPage

Record editing must be fully isolated inside RecordPanel + RecordEditor.

---

## PHASE 1 — Remove Modal System

**Delete or disable:**

- RecordModalContext
- RecordModalProvider
- RecordModal component
- openRecordModal usage
- queueMicrotask logic in record open handlers
- Any modal-based record editing

Remove all references safely.

Record editing must only happen in RecordPanel.

**Files to modify:**
- `baserow-app/contexts/RecordModalContext.tsx` — delete or remove from provider tree
- `baserow-app/components/calendar/RecordModal.tsx` — delete
- `baserow-app/components/layout/WorkspaceShell.tsx` — remove RecordModalProvider
- `baserow-app/components/records/RecordPanel.tsx` — remove handleOpenModal / openRecordModal
- `baserow-app/components/interface/RecordDetailPanelInline.tsx` — remove openRecordModal; either use RecordPanel.openRecord for "open in modal" action, or remove that action (record_view inline stays as inline only)
- All blocks: GridBlock, CalendarBlock, CardListBlock, ListBlock, etc. — replace openRecordModal with openRecord from RecordPanelContext

---

## PHASE 2 — Create Single Record Open Orchestrator

Create a single method inside RecordPanelContext:

```ts
openRecord(recordId: string, tableId: string, fieldLayout?: FieldLayoutItem[])
closeRecord()
```

**openRecord() must:**

1. `setSelectedContext({ type: "record", recordId, tableId })`
2. `setRecordPanelState({ isOpen: true, recordId, tableId, fieldLayout })`

**That is all.**

It must NOT:

- call setRightPanelData
- queue microtasks
- update page settings
- sync to inspector

**Remove any duplicate open logic from:**

- RecordReviewPage
- GridBlock
- CalendarBlock
- CardListBlock
- ListBlock
- Anywhere else

All record open calls must go through RecordPanelContext only.

**Files to modify:**
- `baserow-app/contexts/RecordPanelContext.tsx` — simplify openRecord to only setSelection + setState
- `baserow-app/components/interface/RecordReviewPage.tsx` — remove selectedRecordId sync effect; use openRecord only
- `baserow-app/components/grid/GridView.tsx` — use openRecord only
- `baserow-app/components/views/CalendarView.tsx` — use openRecord only
- `baserow-app/components/interface/blocks/GridBlock.tsx` — pass through to openRecord
- `baserow-app/components/interface/blocks/CardListBlock.tsx`, `ListBlock.tsx`, etc. — same

---

## PHASE 3 — Remove Right Panel Record Sync

**Delete:**

- InterfacePageClient effect that syncs page/blocks to RightPanelData (for record context)
- RecordReviewPage selectedRecordId sync effect
- Any record-based setRightPanelData usage

RightSettingsPanel must not be responsible for record values.

**RightSettingsPanel is only for:**

- Page settings
- Block settings
- Field layout configuration (when block/page selected)

Record editing lives only in RecordPanel.

**Files to modify:**
- `baserow-app/components/interface/InterfacePageClient.tsx` — remove record-related setRightPanelData from sync effect
- `baserow-app/components/interface/RecordReviewPage.tsx` — remove selectedRecordId → setSelectedContext + setRightPanelData effect
- `baserow-app/contexts/RecordPanelContext.tsx` — remove setRightPanelData from openRecord
- `baserow-app/components/interface/RightSettingsPanel.tsx` — remove record layout panel when selectedContext.type === "record" OR keep RecordLayoutSettings but only when opened from block settings (not from record panel)

**Clarification:** RecordLayoutSettings is for when user selects a block and configures record layout — that is block/page config. When user opens a record in RecordPanel, we do NOT show RecordLayoutSettings in RightSettingsPanel. Record layout editing for the open record could live inside RecordPanel/RecordEditor if needed.

---

## PHASE 4 — Record Panel Only Renders RecordEditor

RecordPanel must become a thin shell:

```tsx
<SlideOutPanel open={state.isOpen}>
  <RecordEditor
    recordId={state.recordId}
    tableId={state.tableId}
    fieldLayoutConfig={state.fieldLayout}
    mode="panel"
    onClose={closeRecord}
  />
</SlideOutPanel>
```

**Remove:**

- Local layout editing state
- Duplicate fetch logic
- Any internal selection syncing

RecordPanel should not manage record state itself.  
RecordEditor + useRecordEditorCore handles record fetch/save.

**Files to modify:**
- `baserow-app/components/records/RecordPanel.tsx` — simplify to thin shell

---

## PHASE 5 — Remove Conditional Render Tree in InterfacePageClient

**Replace:**

```tsx
if (loading) return ...
if (!page) return ...
return ...
```

**With a single stable structure:**

```tsx
<PageShell>
  {loading && <LoadingOverlay />}
  {!loading && !page && <ErrorView />}
  {page && <InterfaceBuilder />}
</PageShell>
```

Do not change parent structure between states.

No subtree remounting due to conditional returns.

**Files to modify:**
- `baserow-app/components/interface/InterfacePageClient.tsx` — refactor to single tree

---

## PHASE 6 — Memoise Context Values

Wrap context values in useMemo:

- UIModeContext
- SidebarModeContext
- RecordPanelContext

**Example:**

```tsx
const value = useMemo(() => ({
  mode,
  setMode,
  toggleMode
}), [mode])
```

Do not recreate context objects every render.

**Files to modify:**
- `baserow-app/contexts/UIModeContext.tsx`
- `baserow-app/contexts/SidebarModeContext.tsx`
- `baserow-app/contexts/RecordPanelContext.tsx`

---

## PHASE 7 — Remove Link Fallback Full Reload

**Delete the 100ms fallback:**

```tsx
setTimeout(() => {
  if (window.location.pathname !== targetPath && window.location.pathname === startPath) {
    window.location.href = targetPath
  }
}, 100)
```

Navigation must use router.push or Link only.

Investigate click interception if needed.  
Do not mask with forced reload.

**Files to modify:**
- `baserow-app/components/layout/GroupedInterfaces.tsx` — remove setTimeout fallback from NavigationPage and SortablePage

---

## PHASE 8 — Stabilise Props

Memoise inline objects such as:

```tsx
const cascadeContext = useMemo(() => ({
  blockConfig
}), [blockConfig])
```

Do not pass new objects inline every render.

**Files to modify:**
- `baserow-app/components/interface/blocks/GridBlock.tsx` — cascadeContext
- `baserow-app/components/views/CalendarView.tsx` — cascadeContext
- Other blocks that pass `cascadeContext={{ blockConfig: config }}`

---

## Final Contract

After refactor:

- There is exactly one record editing surface
- There is exactly one openRecord() path
- No queueMicrotask hacks exist
- No setRightPanelData used for record editing
- No record syncing effects in page components
- RightSettingsPanel is layout-only
- RecordPanel handles record editing
- Grid inline editing remains separate
- Navigation does not reload page

---

## Verification Checklist

Confirm:

- [ ] Opening a record opens the side panel only
- [ ] No React #185
- [ ] No cascading context loops
- [ ] No remount storms
- [ ] No full reload navigation
- [ ] No console errors
- [ ] No provider remount on page change

---

## Rules

**Do not:**

- Introduce new record editing surfaces
- Create parallel open flows
- Add effects that sync record into inspector
- Add setState inside render
- Reintroduce modal logic

Keep it simple.

One surface.  
One flow.  
One contract.

---

## Part D — Marketing Hub: Strict Architectural Contract

**This is non-negotiable.**  
Any new feature must obey these rules.

---

### I. Global Rules (Absolute)

#### 1. No State Sync Effects

**Forbidden:**
- `useEffect` that copies state from one context to another
- "Sync" patterns like:
  ```ts
  useEffect(() => {
    setRightPanelData(page)
  }, [page])
  ```

If something needs data:
- It **reads** it.
- It does **not** get pushed it.

#### 2. No Dual Ownership

If two systems hold the same state, the architecture is broken.

There must be:
- **One owner**
- **Multiple readers**
- **One mutation path**

#### 3. No Cross-Domain Mutation

Domains are:
- Page structure
- Block config
- Record data
- Selection
- UI state (panels/modes)

No domain mutates another domain directly.

---

### II. Domain Ownership (Strict)

#### 1. Page Structure

| | |
|---|---|
| **Source of Truth** | Database (interface_pages, interface_blocks) |
| **Owner** | InterfaceBuilder |
| **May mutate** | Block order, block layout, block config |
| **Must NOT** | Fetch record data, set selection, touch RecordPanel, push data to inspector |

#### 2. Block Settings

| | |
|---|---|
| **Source of Truth** | Block config stored inside InterfaceBuilder.blocks |
| **Owner** | BlockSettings components (via inspector) |
| **Mutation path** | BlockSettings → updateBlockConfig → InterfaceBuilder → DB |
| **Must NOT** | Edit record values, open record panels, mutate selection, fetch records |

#### 3. Field Layout (field_layout)

| | |
|---|---|
| **Source of Truth** | Stored in DB (page-level or block-level) |
| **Owner** | Inspector layout editor |
| **May control** | Field order, visibility flags, editability flags |
| **Must NOT** | Hold record values, trigger record open, be duplicated in modal/panel |

RecordEditor **reads** field_layout. It never edits it directly.

#### 4. Record Data

| | |
|---|---|
| **Source of Truth** | Database row |
| **Owner** | useRecordEditorCore |
| **Only mutation path** | RecordEditor → useRecordEditorCore → Supabase |
| **Must NOT** | Live in RightPanelData, live in InterfacePageClient, be mirrored in selection state, be duplicated in RecordReviewPage |

There is exactly one fetch/save implementation.

#### 5. Selection

| | |
|---|---|
| **Source of Truth** | SelectionContext |
| **Contains** | `{ type: "page" \| "block" \| "record", id: string }` |
| **Only changed by** | Explicit user interaction |
| **Forbidden** | Setting selection inside effects, deriving selection from recordPanel state, syncing selection from page load |

Selection represents user intent only.

#### 6. Record Panel

| | |
|---|---|
| **Source of Truth** | RecordPanelContext |
| **Contains** | `{ isOpen, recordId, tableId }` |
| **Only changed by** | `openRecord()`, `closeRecord()` |
| **Forbidden** | Using setRightPanelData, syncing from selection effect, being auto-opened from page effect |

RecordPanel does not coordinate with inspector.

#### 7. Inspector (Right Settings Panel)

| | |
|---|---|
| **Source of Truth** | Derived from selectedContext, InterfaceBuilder state |
| **Does NOT hold** | Record values, page duplicates, blocks duplicates |
| **Rule** | It **reads** state. It does **not** get pushed state. |

---

### III. Strict Forbidden Patterns

These are architectural violations.

**1. "Sync Effect" Pattern**
```ts
useEffect(() => {
  setSomething(derivedValue)
}, [derivedValue])
```
If you see this outside a persistence or logging effect: **It's wrong.**

**2. setState During Render**

Any `if (x) setState(...)` outside event handlers is illegal.

**3. Inline Object Props For Critical Context**
```tsx
<RecordPanel cascadeContext={{ blockConfig }} />
```
This must be memoised:
```tsx
const cascadeContext = useMemo(...)
```
Otherwise you cause invisible render storms.

**4. Conditional Provider Mounting**

Never `if (!page) return null` for major trees.

Providers must remain mounted. Use loading overlays instead.

**5. Multi-Surface Record Editing**

There is:
- ONE RecordEditor
- ONE RecordPanel
- NO modal duplication
- NO review duplication

---

### IV. Render Stability Rules

1. **All context values must be memoised** — Every provider must use `const value = useMemo(() => ({ ... }), [deps])`. Without this, everything re-renders.

2. **All handlers must be useCallback** — No inline handler definitions inside heavy blocks.

3. **All derived arrays must be useMemo** — Examples: fieldIds, visibleFields, groupedData.

4. **Keys must be stable** — Allowed: `block.id`, `record.id`. Forbidden: `block.id + reloadKey`, `index`, `JSON.stringify(...)`.

---

### V. Navigation Contract

1. **Route param is truth** — `/pages/[pageId]` → pageId prop. Never derive pageId from pathname manually.

2. **No full reload fallback hacks** — If Link fails: fix Link. Do not force `window.location.href`.

3. **InterfacePageClient must render ONE tree** — No `loading && !page` / `!page` / `page` branching that changes tree structure. Use:
   ```tsx
   <PageShell>
     {loading && <Overlay />}
     <InterfaceBuilder />
   </PageShell>
   ```

---

### VI. Cascade Prevention Rule

Whenever opening a record:

**Allowed:**
- `setSelectedContext(...)`
- `setRecordPanelState(...)`

**Forbidden:**
- `setRightPanelData(...)`
- `setBlocks(...)`
- `setPage(...)`

No cross-domain mutation.

---

### VII. Testing Checklist (Mandatory Before Merge)

Every feature must confirm:
- [ ] No new sync effects
- [ ] No duplicate fetch logic
- [ ] No new record open flow
- [ ] No new context created without memoisation
- [ ] No new inline object props in hot paths
- [ ] No key changes
- [ ] No conditional provider removal

---

### VIII. If You Break a Rule

Symptoms you'll see:
- React #185
- Infinite mount/unmount
- Calendar re-render storms
- Inspector flicker
- Navigation needing full reload
- queueMicrotask "fixes"

These are signals of domain leakage.

---

### IX. Final Architectural Shape

```
App Shell
  ├─ SelectionContext
  ├─ RecordPanelContext
  ├─ Inspector
  └─ InterfacePageClient
        └─ InterfaceBuilder
              └─ Blocks

RecordEditor exists only inside RecordPanel.
```

Clean. Predictable. Stable.
