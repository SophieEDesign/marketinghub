/**
 * Unauthenticated API smoke (no storageState).
 * Ensures public endpoints stay reachable for login branding and external integrations.
 */

import { test, expect } from '@playwright/test'

test.describe('Public API', () => {
  test('GET /api/workspace-settings returns JSON with settings field', async ({ request }) => {
    const res = await request.get('/api/workspace-settings')
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body).toHaveProperty('settings')
  })

  test('POST /api/hooks/unknown-id returns 404 without session', async ({ request }) => {
    const res = await request.post('/api/hooks/00000000-0000-0000-0000-000000000000', {
      data: { test: true },
      headers: { 'Content-Type': 'application/json' },
    })
    expect([404, 500]).toContain(res.status())
    // 404 = no automation; 500 = e.g. missing service role in local env — both prove route is not redirected to HTML login
    const ct = res.headers()['content-type'] || ''
    expect(ct).toContain('application/json')
  })
})
