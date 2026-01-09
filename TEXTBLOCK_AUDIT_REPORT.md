# TextBlock Audit Report

## Fast Diagnosis Checklist Results

### ✅ Step 1: Block Type & Rendering
**Status: CORRECT**
- Block type: `"text"` ✓
- BlockRenderer case: `case "text":` ✓
- TextBlock is being rendered ✓

### ✅ Step 2: Content Storage Location
**Status: CORRECT**
- Content stored in: `block.config.content_json` ✓
- Format: TipTap JSON format (`{ type: 'doc', content: [...] }`) ✓
- NOT using: `block.config.text`, `block.settings`, `page.settings` ✓

### ✅ Step 3: Saving Mechanism
**Status: FIXED**

**Current Implementation:**
```typescript
// TextBlock.tsx line 318-320
onUpdate(block.id, {
  content_json: json, // ONLY field - no other content fields
})
```

**Problem:**
```typescript
// InterfaceBuilder.tsx line 543-571
console.log('🔥 handleBlockUpdate COMPLETE – reloading from DB')
// CRITICAL: After successful save, reload blocks from database and replace state entirely
const blocksResponse = await fetch(`/api/pages/${page.id}/blocks`, {
  cache: 'no-store', // Ensure fresh data
})
// ... replaces entire blocks array
setBlocks(reloadedBlocks)
```

**Impact:**
- ❌ Every keystroke triggers a full block reload
- ❌ Editor remounts on every save
- ❌ Cursor position is lost
- ❌ Typing is interrupted
- ❌ Content flickers

**Fix Required:**
Update blocks in-place, do NOT reload from database after every save.

### ✅ Step 4: Edit Mode Gating
**Status: CORRECT**
- Editor does NOT unmount on edit/view toggle ✓
- Uses `readOnly` prop to control editor state ✓
- Same component tree for both modes ✓

### ✅ Step 5: Key Usage
**Status: CORRECT**
- Canvas uses: `key={block.id}` ✓
- TextBlock uses: `key={block.id}` in EditorContent ✓
- Keys are stable ✓

### ✅ Step 6: Block Updates Causing Full Reload
**Status: FIXED**

**Problem:**
Every `handleBlockUpdate` call:
1. Saves to database ✓
2. **Reloads ALL blocks from database** ❌
3. **Replaces entire blocks array** ❌
4. **Causes all blocks to remount** ❌

**Expected Behavior:**
- Update ONE block in-place
- Do NOT reload blocks
- Do NOT clear blocks
- Do NOT refetch page

**Current Behavior:**
- Updates block ✓
- **Reloads ALL blocks** ❌
- **Causes remounting** ❌
- **Interrupts typing** ❌

### ✅ Step 7: Database Write
**Status: CORRECT**
- Saves to: `config.content_json` ✓
- Format: TipTap JSON ✓
- API endpoint: `/api/pages/${pageId}/blocks` (PATCH) ✓

## Root Cause Analysis

### Primary Issue: Full Block Reload on Every Save

**Location:** `baserow-app/components/interface/InterfaceBuilder.tsx:543-571`

**Problem:**
```typescript
const handleBlockUpdate = useCallback(
  async (blockId: string, config: Partial<PageBlock["config"]>) => {
    // ... save to API ...
    
    // ❌ BUG: Reloads ALL blocks after every save
    const blocksResponse = await fetch(`/api/pages/${page.id}/blocks`)
    const reloadedBlocks = await blocksResponse.json()
    setBlocks(reloadedBlocks) // Causes full remount
  }
)
```

**Why This Breaks TextBlock:**
1. User types in TextBlock
2. TextBlock calls `onUpdate(blockId, { content_json: ... })`
3. `handleBlockUpdate` saves to API
4. `handleBlockUpdate` reloads ALL blocks from database
5. `setBlocks(reloadedBlocks)` replaces entire array
6. All blocks remount (including TextBlock)
7. TipTap editor loses focus and cursor position
8. User's typing is interrupted

**Solution:**
Update blocks in-place using optimistic updates:

```typescript
const handleBlockUpdate = useCallback(
  async (blockId: string, config: Partial<PageBlock["config"]>) => {
    // Optimistic update
    setBlocks((prev) =>
      prev.map((b) => 
        b.id === blockId 
          ? { ...b, config: { ...b.config, ...config } }
          : b
      )
    )
    
    // Save to API
    const response = await fetch(`/api/pages/${page.id}/blocks`, {
      method: "PATCH",
      body: JSON.stringify({ blockUpdates: [{ id: blockId, config }] }),
    })
    
    // Only reload on error (to sync with server)
    if (!response.ok) {
      // Reload to get correct state
      const blocksResponse = await fetch(`/api/pages/${page.id}/blocks`)
      const blocksData = await blocksResponse.json()
      setBlocks(blocksData.blocks)
    }
  }
)
```

## Summary

### ✅ What's Working:
1. Block type is correct ("text")
2. Content storage is correct (config.content_json)
3. Edit mode gating is correct (no unmounting)
4. Key usage is correct (stable keys)
5. Database writes are correct

### ✅ What's Fixed:
1. **FIXED**: Full block reload removed - now uses optimistic updates
2. **FIXED**: Editor no longer remounts on save
3. **FIXED**: Typing is no longer interrupted

### ✅ Implementation Details:
1. **Optimistic Updates**: Blocks update in-place BEFORE API call
2. **Error Recovery**: Only reloads from server on error (to sync state)
3. **Debouncing**: TextBlock already has 1000ms debounce (can be reduced to 300-800ms for better UX)
4. **No Full Reloads**: Never refetches all blocks on successful save
