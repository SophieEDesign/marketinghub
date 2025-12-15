# Phase 1 Implementation - Next Steps

## Critical Files Still Need Modification

### 1. Auth Module Registration
**File:** `packages/nocodb/src/modules/auth/auth.module.ts`
**Action:** Add SupabaseJwtStrategy to providers array
```typescript
import { SupabaseJwtStrategy } from '~/strategies/supabase-jwt.strategy/supabase-jwt.strategy';

providers: [
  AuthService,
  LocalStrategy,
  AuthTokenStrategy,
  SupabaseJwtStrategy, // ADD THIS
  BaseViewStrategy,
  BasicStrategy,
  GoogleStrategyProvider,
],
```

### 2. Global Guard - Use Supabase Strategy
**File:** `packages/nocodb/src/guards/global/global.guard.ts`
**Action:** Update to use 'supabase-jwt' strategy instead of 'authtoken' for Bearer tokens

### 3. Views Service - Add Access Control
**File:** `packages/nocodb/src/services/views.service.ts`
**Action:** Import and use `filterViewsByAccess()` in `viewList()` method
```typescript
import { filterViewsByAccess } from '~/helpers/viewAccessControl';

// In viewList method, after getting views:
const filteredViewList = filterViewsByAccess(viewList, param.user);
```

### 4. View Controller - Public Share Route
**File:** `packages/nocodb/src/controllers/viewController.ts` (or similar)
**Action:** Add route `/view/p/:public_share_id` that:
- Looks up view by public_share_id
- Returns read-only view data
- No authentication required

### 5. Database Migration
**Action:** Run the migration file:
```bash
# In Supabase SQL Editor, run:
packages/nocodb/src/db/migrations/supabase-access-control.sql
```

### 6. Environment Variables
**File:** `.env` or environment configuration
**Action:** Add:
```
SUPABASE_JWT_SECRET=your_supabase_jwt_secret
SUPABASE_DB_HOST=your_supabase_host
SUPABASE_DB_PORT=5432
SUPABASE_DB_NAME=postgres
SUPABASE_DB_USER=postgres
SUPABASE_DB_PASSWORD=your_password
SUPABASE_DB_SSL=true
```

### 7. Frontend Auth Store
**File:** `packages/nc-gui/store/auth.ts`
**Action:** Update to:
- Get JWT from Supabase Auth
- Send as `Authorization: Bearer <token>` header
- Handle Supabase user metadata/roles

### 8. UI Cleanup
**Files to modify/remove:**
- `packages/nc-gui/pages/playground/` - Remove API Explorer
- `packages/nc-gui/components/` - Remove external DB connectors
- `packages/nc-gui/pages/projects/` - Simplify project selector
- SQL editor components - Comment out or remove

### 9. Routing Simplification
**File:** `packages/nc-gui/router/` or `packages/nc-gui/pages/`
**Action:** 
- Remove `/nc/project/` routes
- Add `/tables/:tableId/:viewType` routes
- Update navigation components

### 10. Package Dependencies
**File:** `packages/nocodb/package.json`
**Action:** Ensure `jsonwebtoken` is installed:
```bash
cd packages/nocodb
pnpm add jsonwebtoken
pnpm add -D @types/jsonwebtoken
```

## Testing Checklist

After implementing:

1. ✅ Start NocoDB backend with Supabase config
2. ✅ Frontend sends Supabase JWT in Authorization header
3. ✅ Views are filtered by access control
4. ✅ Public share links work without auth
5. ✅ Role-based access works correctly
6. ✅ Database queries use Supabase PostgreSQL

## Notes

- All changes are in the cloned NocoDB repository
- Do NOT modify the main Marketing Hub project
- Test thoroughly before deploying
