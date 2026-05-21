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

  // REG-001/002/003: when E2E_AUTH is configured, assert bulk bar only with 2+ checkboxes.
  // See docs/audits/REGRESSION_RISK_AUDIT_2026-05.md
  test.skip(!process.env.E2E_CORE_DATA_TABLE_URL, 'REG-001 bulk bar — set E2E_CORE_DATA_TABLE_URL', async ({ page }) => {
    await page.goto(process.env.E2E_CORE_DATA_TABLE_URL!)
    await page.getByLabel('Open record').first().click()
    await expect(page.getByText(/records selected/i)).not.toBeVisible()
    const checkboxes = page.locator('input[type="checkbox"]')
    await checkboxes.nth(1).click()
    await checkboxes.nth(2).click()
    await expect(page.getByText(/2 records selected/i)).toBeVisible()
  })
})
