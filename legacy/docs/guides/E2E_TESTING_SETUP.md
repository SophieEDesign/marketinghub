# E2E Testing Setup Guide

**Date:** February 2026  
**Related:** [COMPREHENSIVE_APP_AUDIT_2026](../audits/COMPREHENSIVE_APP_AUDIT_2026.md) — Phase 5

---

## Overview

The Marketing Hub currently has 9 unit/integration test files in `baserow-app/__tests__/`. E2E (end-to-end) tests are not yet configured. This guide describes how to add Playwright for E2E testing.

## Recommended: Playwright

1. **Install Playwright**
   ```bash
   cd baserow-app
   npm init playwright@latest
   ```
   Select: TypeScript, tests in `e2e/`, add GitHub Actions (optional).

2. **Configure for Next.js**
   - Base URL: `process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'`
   - Start dev server before tests: `webServer: { command: 'npm run dev', url: 'http://localhost:3000', reuseExistingServer: !process.env.CI }`

3. **Critical flows to test**
   - Login → redirect to default page
   - Navigate sidebar → page loads
   - Open record from grid/calendar → record panel opens
   - Create table → table appears in sidebar

4. **Auth handling**
   - Use `storageState` for authenticated sessions
   - Or set `AUTH_BYPASS=true` in test env (dev only)

## Alternative: Cypress

Cypress is also supported. Configure `cypress.config.ts` with baseUrl and ensure `viewportWidth`/`viewportHeight` match app layout.

## Current Test Coverage

- `api-routes.test.ts`, `api-routes-extended.test.ts` — API route integration
- `error-handling.test.ts` — Error utilities
- `interface-invariants.test.ts` — Interface lifecycle
- `rate-limit.test.ts` — Rate limiting (when env not set)
- `utils.test.ts`, `utils-extended.test.ts` — Utilities
- `data-view-*.test.ts` — Data view validation

Run: `npm test` (or `npm run test`)
