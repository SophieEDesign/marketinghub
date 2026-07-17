# Record View Audit & Corrections

## Overview
Comprehensive audit and correction of the Record View (detail panel / record page) to improve interaction clarity, visual hierarchy, and UX correctness. Focus on making the record view calm, intentional, and predictable.

## Core Principles Applied
- **Selection ≠ Navigation**: Clicking field backgrounds or pills no longer triggers navigation
- **Pills represent values, not implicit actions**: Only explicit label clicks navigate
- **Linked fields are editable; lookup fields are read-only**: Clear visual distinction
- **All navigation must be explicit**: No accidental navigation

---

## Changes Made

### 1. InlineFieldEditor.tsx

#### Linked vs Lookup Field Separation
- **Lookup Fields (Derived)**:
  - Clearly marked with "Derived" indicator and chain icon
  - Muted visual styling (gray-50/50 background, lighter borders)
  - Read-only pills that only navigate on label click
  - Paste blocked with clear error message: "This field is derived and can't be edited."

- **Linked Fields (Editable)**:
  - Clear editable styling (blue-50 pills, blue borders on hover)
  - Explicit "+" button for adding records
  - Full editing capabilities
  - Paste allowed (handled by LookupFieldPicker)

#### Visual Improvements
- Increased spacing: `space-y-2` → `space-y-2.5`
- Reduced border weight: `border-gray-200` → `border-gray-200/50` for read-only
- Better padding: `px-3 py-2` → `px-3.5 py-2.5`
- Consistent min-height: `min-h-[40px]` for all field containers
- Improved hover states: `hover:border-blue-400` and `hover:bg-blue-50/30`

#### Paste Handling
- Added `handlePaste` callback that blocks paste for lookup fields
- Shows toast notification: "Cannot edit derived field - This field is derived and can't be edited."

---

### 2. LookupFieldPicker.tsx

#### Navigation Fixes
- **Pill Label Click Only**: Navigation only occurs when clicking the pill label text, not the entire pill
- **Field Background**: Clicking field background opens picker (for editable fields) or does nothing (for lookup fields)
- Removed accidental navigation triggers

#### Visual Distinction
- **Lookup Fields (Read-only)**:
  - Muted styling: `bg-gray-100/80`, `border-gray-200/50`, `text-gray-600`
  - No popover/picker interaction
  - Only label text is clickable for navigation
  - No remove buttons or add buttons

- **Linked Fields (Editable)**:
  - Active styling: `bg-blue-50`, `border-blue-200/50`, `text-blue-700`
  - Clear "+" button for adding records
  - Remove buttons on pills
  - Full popover interaction

#### Removed Mystery Actions
- Removed hover preview card (was causing confusion)
- Removed `onMouseEnter`/`onMouseLeave` handlers
- Removed preview state management
- Cleaner, more predictable interactions

#### Improved Add Button
- Explicit "+" button always visible when field is editable
- Positioned clearly separate from pills
- Only appears for editable linked fields

---

### 3. RecordFields.tsx

#### Visual Hierarchy Improvements
- Increased spacing between groups: `space-y-6` → `space-y-8`
- Increased spacing within groups: `space-y-4` → `space-y-6`
- Reduced border weight: `border-gray-200` → `border-gray-200/60`
- Better group header styling: `bg-gray-50/80`, `border-b border-gray-200/60`
- Improved padding: `p-4` → `p-5` for group content

---

## Behavior Specifications

### A. Linked Fields (relationship fields)

**Display:**
- Values shown as rounded pills with blue styling
- Pills wrap cleanly and do not overflow
- Empty state shows explicit "+" button affordance

**Interaction:**
- Click pill label → open linked record
- Click field background → open record picker
- Click "+" → open record picker
- Backspace/delete removes selected pill only
- Paste is allowed (with resolution handled elsewhere)

**Visual rules:**
- Pills look clickable (blue-50 background, blue-700 text)
- Field container looks editable (hover states, focus rings)
- Action (+) is visually distinct from pills

---

### B. Lookup Fields (derived fields)

**Display:**
- Values shown as muted pills (gray styling)
- Visually muted compared to linked fields
- "Derived" indicator with chain icon

**Interaction:**
- Click pill label → open linked record
- Field background is NOT editable
- Paste is blocked with explanation
- Delete/remove actions are not shown

**UX rule:**
Lookup fields must feel informational, not interactive.

---

### C. Copy & Paste (Record View)

**Copy:**
- Linked fields → copy display labels
- Lookup fields → copy computed display value

**Paste:**
- Linked fields → allowed
- Lookup fields → blocked with inline explanation:
  "This field is derived and can't be edited."

No silent failures.

---

### D. Navigation Rules

- Highlighting or focusing a field never opens records
- Only explicit actions trigger navigation:
  - Clicking a pill label
  - Double-click / Enter (if supported)
  - Dedicated open icons
- Closing a record returns the user to:
  - the same grid
  - same scroll position
  - same selection where possible

---

### E. Visual Cleanup

- Reduced border weight (50% opacity for read-only)
- Increased whitespace (2.5 spacing units)
- Consistent alignment of:
  - field labels
  - pills
  - actions
- Grouped derived fields subtly where appropriate

---

## Files Modified

1. `baserow-app/components/records/InlineFieldEditor.tsx`
   - Separated linked vs lookup field rendering
   - Added paste handling
   - Improved visual styling and spacing
   - Added derived field indicator

2. `baserow-app/components/fields/LookupFieldPicker.tsx`
   - Fixed navigation to only occur on label clicks
   - Removed hover preview card
   - Improved visual distinction for read-only vs editable
   - Added explicit add button

3. `baserow-app/components/records/RecordFields.tsx`
   - Improved visual hierarchy
   - Better spacing and alignment
   - Reduced border weight

---

## Testing Checklist

- [ ] Linked fields show blue pills and are editable
- [ ] Lookup fields show gray pills with "Derived" indicator
- [ ] Clicking pill label navigates to record
- [ ] Clicking field background does NOT navigate (only opens picker for editable)
- [ ] Paste is blocked for lookup fields with clear message
- [ ] Paste works for linked fields
- [ ] Add button appears for editable linked fields
- [ ] Remove buttons appear on editable linked field pills
- [ ] No hover preview cards appear
- [ ] Visual hierarchy is clear and calm
- [ ] Spacing is consistent and comfortable

---

## Design Intent

The record view now feels closer to Airtable / Notion / Linear:
- **Calm**: Reduced visual noise, muted read-only fields
- **Deliberate**: Explicit actions, no accidental navigation
- **Trustworthy**: Clear distinction between editable and derived
- **Easy to understand**: Visual hierarchy makes field types obvious at a glance
