# Rectification Prompt (Cursor / AI Engineer)

## Context

You are working on a complex app with Core Data, Interfaces, Canvas, Blocks, and Record Editing.

A full architectural audit has already been completed.  
This task is **rectification only**, guided strictly by that audit.

---

## 🚨 HARD CONSTRAINTS (DO NOT VIOLATE)

- ❌ Do NOT break anything that currently works  
- ❌ Do NOT change behaviour  
- ❌ Do NOT rename files, components, tables, routes, or concepts  
- ❌ Do NOT delete existing components  
- ❌ Do NOT do large refactors or migrations  
- ❌ Do NOT remove spreadsheet-like behaviour from Core Data  

All changes must be:

- incremental  
- additive  
- compatibility-preserving  
- behind existing abstractions where possible  

---

## 🎯 Goal

Move the system toward:

**One system. One source of truth. One editing model.**

By aligning behaviour, reducing duplication, and centralising logic,  
without changing what users experience today.

---

## 🧠 Locked Mental Model (DO NOT ARGUE WITH THIS)

### Core Data

- Spreadsheet-style  
- Fast inline editing  
- Dense layout  
- Keyboard-first  
- Canonical source of: fields, field labels, field types, select options, linked & lookup relationships  

### Interfaces

- Curated experiences  
- Built from the same Canvas engine  
- Consume Core Data, never redefine it  

### Pages

- Only Canvas pages  
- “Full-page views” are blocks with fullPage: true  
- No separate “record view page” concept  

### Blocks

- Describe what to show, not how it behaves  
- Same block = same settings everywhere  
- Embedded or full-page via config  

### Record Editor

- Exactly one logical Record Editor  
- Modes: view | edit | create  
- Shells: modal | full-page  
- Same fields, validation, permissions everywhere  

### Create Record

- Create = Record Editor in create mode  
- No separate “mini create” experiences  

### Fields

- Fields must behave identically everywhere  
- Same renderer, same validation, same permissions  
- Same linked-record behaviour  
- Same “add new option / record” experience  

### Field Labels

- UI must use field labels, never raw IDs or column names  
- ✅ Content Name  
- ❌ content_name  
- Internal IDs remain internal only  

---

## 🛠️ Rectification Tasks (IN ORDER)

### 1️⃣ Block System Alignment (NO MERGE YET)

**Goal:** Stop divergence without breaking anything.

- Identify all places where block behaviour, settings, or defaults are duplicated  
- Add non-breaking adapters or shared helpers so:  
  - block settings logic comes from one place  
  - appearance settings are not reimplemented per block  
- Do NOT remove the second block system yet  
- Do NOT migrate data  
- Do NOT change rendering paths  

**Result:** Fewer “special cases”, same output  

---

### 2️⃣ Record Editor Unification (LOGICAL, NOT VISUAL)

**Goal:** One logical editor, multiple shells.

- Introduce a single shared record editor **core** (logic-level only)  
- Existing components (RecordModal, RecordPanel, RecordDrawer, etc.) should:  
  - delegate to this core  
  - keep their shells (modal / panel / drawer)  
- Inline editing remains unchanged  
- Create mode uses the same editor core  
- No UI redesign yet  

---

### 3️⃣ Create Record Flow

**Goal:** One create experience.

- Ensure all “create record” entry points:  
  - grid  
  - cards (kanban / calendar / timeline)  
  - field blocks  
  - record editor  
  escalate to the same Record Editor (create mode)  
- Do NOT remove inline “add row” in Core Data  
- Do NOT remove quick-add affordances  
- Just unify what happens after escalation  

---

### 4️⃣ Field Behaviour Consistency

**Goal:** Same field everywhere.

- Centralise field rendering and editing logic  
- Ensure linked fields, lookup fields, select fields behave the same in:  
  - grid  
  - cards  
  - record editor  
  - field blocks  
- Add missing support where schema already allows it (e.g. linked field list display mode)  
- Select fields: “Allow add new record/option” — same modal, same behaviour everywhere  

---

### 5️⃣ Filters & Conditions (UI Alignment Only)

**Goal:** One engine, one mental model.

- Do NOT change filter evaluation logic  
- Align filter UIs to the same primitives where possible  
- Ensure operators and grouping behave identically  
- Avoid feature-specific condition logic  

---

### 6️⃣ Permissions Cascade (Respect Existing Rules)

**Goal:** Field > Block > Page  

- Do NOT invent new permissions  
- Centralise permission checks so:  
  - field-level rules are always respected  
  - block-level rules can restrict further  
  - page-level rules override last  
- Behaviour must remain unchanged  

---

### 7️⃣ Appearance & Spacing (FOUNDATION ONLY)

**Goal:** Enable consistency later without visual regressions.

- Introduce shared spacing / layout tokens  
- Do NOT redesign UI  
- Do NOT remove existing classes yet  
- Allow future convergence safely  

---

## 🔍 Validation Checklist (MANDATORY)

After each change, verify:

- ✅ Core Data still behaves like a spreadsheet  
- ✅ Inline editing still works everywhere  
- ✅ No views disappear  
- ✅ No permissions regress  
- ✅ No routes change  
- ✅ No UX regressions  
- ✅ No new concepts introduced  

---

## 🛑 Explicitly Out of Scope

- Visual redesign  
- Renaming concepts  
- Removing legacy systems  
- Performance optimisations  
- Feature expansion  
- Behavioural changes  

---

## 🧩 Output Expectation

For each rectification step:

1. **Explain what was aligned**  
2. **Explain what was left untouched**  
3. **Explain why this does not break existing behaviour**  

If a task cannot be done safely:

- **Stop**  
- **Explain the risk**  
- **Propose a future step instead**  

---

## Final Reminder

This is **surgical alignment**, not a rewrite.

- **Stability > purity**  
- **Compatibility > cleverness**  
- **Truth > duplication**  

Proceed carefully.
