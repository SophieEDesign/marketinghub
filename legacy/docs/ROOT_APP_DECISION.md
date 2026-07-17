# Root App Directory Decision

## Current State

The root `app/` directory contains a **separate Next.js application** that runs in parallel to `baserow-app/`.

### Root App Structure
- **Routes**: `/data/[tableId]`, `/tables/[tableId]`, `/import`
- **Files**: 9 files with 64 imports
- **Dependencies**: Uses root-level `components/`, `lib/`, and `types/` directories
- **Status**: **ACTIVE** - Separate application, not legacy code

### Baserow App Structure  
- **Routes**: `/tables`, `/pages`, `/interface`, `/settings`, etc.
- **Files**: 294 files with 1,285 imports
- **Status**: **PRIMARY** - Main active application

## Decision Options

### Option A: Keep Both Applications (Recommended)
**Pros:**
- Maintains existing functionality
- No migration risk
- Both apps can serve different purposes

**Cons:**
- Code duplication
- Maintenance overhead
- Potential confusion about which app to use

**Action Required:**
- Document which app serves which purpose
- Clearly mark primary vs secondary application
- Consider deprecation timeline if one becomes redundant

### Option B: Migrate Root App to Use Baserow-App Components
**Pros:**
- Single source of truth
- Eliminates duplication
- Unified codebase

**Cons:**
- Migration effort required
- Risk of breaking existing functionality
- Testing required for all routes

**Action Required:**
- Audit all root app routes
- Map dependencies
- Create migration plan
- Test thoroughly

### Option C: Remove Root App (NOT RECOMMENDED)
**Pros:**
- Simplifies codebase
- Removes duplication

**Cons:**
- **HIGH RISK** - Root app is active and serves real routes
- Would break existing functionality
- Users may depend on these routes

**Action Required:**
- Verify no users depend on root app routes
- Check analytics/logs for usage
- Plan deprecation if truly unused

## Recommendation

**Option A: Keep Both Applications** with clear documentation.

### Rationale
1. Root app is **active** and serves real routes
2. Migration risk is high without thorough testing
3. Both apps may serve different user needs
4. Better to document clearly than risk breaking functionality

### Documentation Actions
1. ✅ Create this decision document
2. ⏳ Update README to clarify app structure
3. ⏳ Add comments in root app explaining its purpose
4. ⏳ Consider adding route documentation

## Next Steps

1. **Short Term**: Document the dual-app structure
2. **Medium Term**: Monitor usage of root app routes
3. **Long Term**: If root app usage is low, plan migration to Option B

## Notes

- Root app routes (`/data/*`, `/import`) may be legacy or serve a specific use case
- Baserow-app is clearly the primary application with more features
- Both apps share the same database (Supabase)
- Consider if root app can be consolidated into baserow-app routes
