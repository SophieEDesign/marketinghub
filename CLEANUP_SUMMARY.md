# Code Cleanup Summary

**Date:** January 2025  
**Status:** Partial cleanup completed

---

## ✅ Completed Actions

### 1. Removed Duplicate Files

- ✅ **Deleted:** `lib/utils.ts` 
  - Reason: Identical duplicate of `baserow-app/lib/utils.ts`
  - Impact: None (root version was not imported)

---

## ⚠️ Important Discovery

### Two Separate Next.js Applications

The codebase contains **TWO separate Next.js applications**:

1. **Root App** (`app/`, `components/`, `lib/` at root)
   - Routes: `/data/[tableId]`, `/tables/[tableId]`, `/import`
   - Uses root-level components and lib
   - 9 files, 64 imports

2. **Baserow App** (`baserow-app/`)
   - Routes: `/tables`, `/pages`, `/interface`, `/settings`
   - Complete Next.js app with package.json
   - 294 files, 1,285 imports

**Both are active and serve different purposes!**

---

## 🔍 Files That Cannot Be Deleted

These files are **actively used** by the root `app/` directory:

### Root Components (Used by Root App)
- `components/ui/*` - All UI components
- `components/navigation/*` - Navigation components
- `components/views/InterfacePage.tsx` - Interface page component
- `components/blocks/BlockRenderer.tsx` - Block renderer (used by InterfacePage)

### Root Libraries (Used by Root App)
- `lib/supabase.ts` - Supabase client
- `lib/icons.ts` - Icon utilities
- `lib/views.ts` - View utilities
- `lib/blocks.ts` - Block utilities
- `lib/data.ts` - Data utilities
- `lib/permissions.ts` - Permission utilities
- `lib/navigation.ts` - Navigation utilities

### Root Types (Used by Root App)
- `types/database.ts` - Database type definitions

---

## 📋 Recommendations

### Option 1: Keep Both Apps (Current State)
- **Pros:** Both apps can coexist
- **Cons:** Code duplication, maintenance overhead
- **Action:** Document which app serves which purpose

### Option 2: Consolidate to Baserow App
- **Pros:** Single codebase, no duplication
- **Cons:** Requires migration work
- **Action:** 
  1. Migrate root `app/` routes to `baserow-app/app/`
  2. Update imports to use `baserow-app/` components
  3. Delete root `app/`, `components/`, `lib/` directories

### Option 3: Separate Repositories
- **Pros:** Clear separation, independent development
- **Cons:** Shared code becomes harder
- **Action:** Split into two repositories

---

## 🎯 Next Steps

1. **Documentation:** 
   - Document which app is primary
   - Document purpose of each app
   - Create architecture diagram

2. **Decision Required:**
   - Choose Option 1, 2, or 3 above
   - Get stakeholder approval

3. **If Consolidating:**
   - Create migration plan
   - Migrate routes gradually
   - Test thoroughly before deletion

---

## 📊 Statistics

- **Files Deleted:** 1 (`lib/utils.ts`)
- **Files Identified as Duplicates:** ~50+
- **Files Confirmed as Active:** ~30+ (root app dependencies)
- **Cleanup Potential:** Low (both apps are active)

---

**Status:** Cleanup paused pending architectural decision  
**Next Review:** After architectural decision

