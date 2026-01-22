# Multi Calendar and Multi Timeline Audit Report

**Date:** 2025-01-XX  
**Scope:** MultiCalendarView and MultiTimelineView components  
**Status:** In Progress

## Executive Summary

This audit identified **8 critical issues** and **12 additional improvements** needed in the multi calendar and timeline views. The most critical issues are:

1. **No error handling** in data loading - errors are silently swallowed
2. **Field resolution inconsistency** - MultiTimelineView doesn't resolve field names/IDs
3. **Missing abort error handling** - requests aren't cancelled on unmount
4. **No partial failure handling** - one failing source blocks all others
5. **Inefficient dependency tracking** - JSON.stringify in useEffect

---

## Critical Issues (Must Fix)

### 1. Error Handling in loadAll() Functions

**Severity:** 🔴 Critical  
**Files:** 
- `baserow-app/components/views/MultiCalendarView.tsx` (lines 220-316)
- `baserow-app/components/views/MultiTimelineView.tsx` (lines 155-243)

**Problem:**
- Both components have try/finally blocks but **no catch blocks**
- Supabase query errors are never checked
- Errors are silently swallowed - users see no feedback
- No partial failure handling - if one source fails, all fail silently

**Current Code:**
```typescript
// MultiCalendarView - line 235-239
const tableRes = await supabase
  .from("tables")
  .select("id, name, supabase_table")
  .eq("id", tableId)
  .single()
// ❌ No error check!

// MultiTimelineView - line 168-172
const tableRes = await supabase
  .from("tables")
  .select("id, name, supabase_table")
  .eq("id", tableId)
  .single()
// ❌ No error check!
```

**Impact:**
- Users see empty calendars/timelines with no explanation
- Network errors go unnoticed
- Database errors (missing tables, permission issues) are hidden
- Debugging is difficult without error logs

**Fix Required:**
- Add error checking to all Supabase queries
- Use `isAbortError()` to ignore abort errors
- Implement partial failure handling (continue loading other sources if one fails)
- Add error state management and user-visible error messages
- Log errors for debugging

---

### 2. Field Resolution Inconsistency

**Severity:** 🔴 Critical  
**File:** `baserow-app/components/views/MultiTimelineView.tsx` (line 274)

**Problem:**
- MultiCalendarView uses `resolveFieldNameFromFields()` helper (line 94-100)
- MultiTimelineView directly accesses `row[s.start_date_field]` without resolution
- This will fail if config stores field IDs instead of names
- Field name normalization (snake_case vs camelCase) is inconsistent

**Current Code:**
```typescript
// MultiCalendarView - CORRECT ✅
const startFieldName = resolveFieldNameFromFields(tableFields, s.start_date_field)
const row = r.data || {}
const startRaw = startFieldName ? row[startFieldName] : null

// MultiTimelineView - WRONG ❌
const row = r.data || {}
const startRaw = row[s.start_date_field]  // Direct access - may fail!
```

**Impact:**
- MultiTimelineView breaks when field config uses IDs
- Inconsistent behavior between calendar and timeline
- Field name mismatches cause silent failures

**Fix Required:**
- Add `resolveFieldNameFromFields()` helper to MultiTimelineView
- Use field name resolution for all field accesses
- Ensure consistent field name normalization

---

### 3. Missing Abort Error Handling

**Severity:** 🟡 High  
**Files:** Both components

**Problem:**
- No `isAbortError()` checks in error handling
- Requests continue after component unmounts
- Can cause memory leaks and unnecessary network traffic

**Comparison:**
- Single CalendarView properly handles abort errors (line 644, 672)
- Multi views have no abort handling

**Fix Required:**
- Import `isAbortError` from `@/lib/api/error-handling`
- Check for abort errors before logging/displaying errors
- Early return on abort errors

---

### 4. Inefficient Dependency Tracking

**Severity:** 🟡 High  
**File:** `baserow-app/components/views/MultiTimelineView.tsx` (line 248)

**Problem:**
- Uses `JSON.stringify(sources)` and `JSON.stringify(filters)` in useEffect dependencies
- Causes unnecessary re-renders and recalculations
- Inefficient for large objects
- Can cause infinite loops if objects are recreated each render

**Current Code:**
```typescript
useEffect(() => {
  loadAll()
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [JSON.stringify(sources), JSON.stringify(filters)])  // ❌ Inefficient!
```

**Comparison:**
- MultiCalendarView uses stable `sourcesKey` and `filtersKey` (lines 207-218)
- MultiTimelineView should use the same pattern

**Fix Required:**
- Create stable keys using `useMemo` (similar to MultiCalendarView)
- Use keys in dependency arrays instead of JSON.stringify

---

### 5. Date Parsing Inconsistency

**Severity:** 🟡 Medium  
**Files:** Both components

**Problem:**
- Both use basic `new Date()` parsing without timezone handling
- No date-only vs datetime distinction
- Single CalendarView has `parseDateValueToLocalDate()` helper (line 61-69)
- Missing invalid date validation

**Current Code:**
```typescript
// MultiCalendarView - line 353-357
const start = new Date(startRaw)
if (isNaN(start.getTime())) return
const end = endRaw ? new Date(endRaw) : start
const finalEnd = isNaN(end.getTime()) ? start : end

// MultiTimelineView - line 276-281
const start = new Date(startRaw)
if (isNaN(start.getTime())) return
const end = endRaw ? new Date(endRaw) : start
const finalEnd = isNaN(end.getTime()) ? start : end
```

**Impact:**
- Timezone shifts can cause events to appear on wrong days
- Date-only values may be parsed as UTC midnight instead of local midnight

**Fix Required:**
- Use `parseDateValueToLocalDate()` helper from CalendarView
- Ensure consistent date parsing across all views

---

## Performance Issues

### 6. Missing Memoization

**Severity:** 🟡 Medium  
**Files:** Both components

**Issues:**
- Field resolution results aren't memoized
- `events` useMemo in MultiCalendarView depends on many values (may recalculate frequently)
- `eventsByLane` in MultiTimelineView recalculates on every events change

**Fix Required:**
- Memoize field resolution results per source
- Review useMemo dependencies for optimization opportunities

---

### 7. Full Table Scans

**Severity:** 🟢 Low  
**Files:** Both components

**Issue:**
- Both use `select("*")` for all sources
- No query optimization for large datasets
- Could benefit from date range filtering at query level

**Note:** This may be intentional for flexibility, but worth reviewing for performance-critical scenarios.

---

## Code Quality Issues

### 8. Type Safety

**Severity:** 🟡 Medium  
**Files:** Both components

**Issues:**
- Heavy use of `any` types in data mapping
- Type assertions without validation
- Missing runtime validation

**Fix Required:**
- Reduce `any` usage
- Add runtime validation for critical data
- Improve type narrowing

---

### 9. State Management

**Severity:** 🟢 Low  
**Files:** Both components

**Issues:**
- Multiple useState calls that could be consolidated
- Complex enabled source IDs sync logic in MultiCalendarView
- Could benefit from useReducer for complex state

---

## User Experience Issues

### 10. Loading States

**Severity:** 🟡 Medium  
**Files:** Both components

**Issues:**
- Generic "Loading…" message
- No progress indication for multiple sources
- No differentiation between "no sources" vs "no data"

**Fix Required:**
- Add progress indicator showing which sources are loading
- Better empty states with actionable messages

---

### 11. Error States

**Severity:** 🟡 Medium  
**Files:** Both components

**Issues:**
- No user-visible error messages
- No error recovery UI
- Silent failures confuse users

**Fix Required:**
- Display error messages per source
- Add retry functionality
- Show which sources failed to load

---

## Testing Scenarios

The following scenarios should be tested after fixes:

1. ✅ Multiple sources with different field structures
2. ✅ One source fails to load (others should still work)
3. ✅ Sources with missing/invalid date fields
4. ✅ Large number of sources (10+)
5. ✅ Rapid source enable/disable toggling
6. ✅ Date range filtering with no results
7. ✅ Drag operations with network failures
8. ✅ Concurrent filter changes
9. ✅ Component unmount during loading
10. ✅ Field config with IDs vs names

---

## Implementation Priority

### Phase 1: Critical Fixes (Immediate)
1. Error handling in loadAll() functions
2. Field resolution consistency
3. Abort error handling
4. Dependency tracking fix

### Phase 2: Important Improvements (Next Sprint)
5. Date parsing consistency
6. Partial failure handling
7. Error state UI
8. Loading state improvements

### Phase 3: Quality Improvements (Backlog)
9. Performance optimizations
10. Type safety improvements
11. State management refactoring

---

## Comparison Matrix

| Feature | Single CalendarView | MultiCalendarView | Single TimelineView | MultiTimelineView |
|--------|---------------------|-------------------|-------------------|-------------------|
| Error handling | ✅ Full | ❌ None | ✅ Full | ❌ None |
| Abort handling | ✅ Yes | ❌ No | ✅ Yes | ❌ No |
| Field resolution | ✅ Helper | ✅ Helper | ✅ Helper | ❌ Direct access |
| Date parsing | ✅ parseDateValueToLocalDate | ❌ Basic | ✅ parseDateValueToLocalDate | ❌ Basic |
| Partial failures | N/A | ❌ No | N/A | ❌ No |
| Error UI | ✅ Yes | ❌ No | ✅ Yes | ❌ No |
| Loading progress | N/A | ❌ No | N/A | ❌ No |

---

## Next Steps

1. Implement Phase 1 fixes
2. Test all scenarios
3. Update documentation
4. Add error monitoring/logging
5. Consider adding unit tests for error cases
