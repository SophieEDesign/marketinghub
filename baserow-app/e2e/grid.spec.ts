/**
 * E2E: Grid view flows
 * Requires authenticated session and existing table
 */

import { test, expect } from '@playwright/test'

test.describe('Grid', () => {
  test('tables route redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/tables')
    await expect(page).toHaveURL(/\/login/)
  })

  test('table view requires auth', async ({ page }) => {
    await page.goto('/tables/test-id')
    await expect(page).toHaveURL(/\/login/)
  })
})
