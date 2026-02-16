/**
 * E2E: Auth flows (login, logout)
 * Requires running app and valid test credentials
 */

import { test, expect } from '@playwright/test'

test.describe('Auth', () => {
  test('login page loads', async ({ page }) => {
    await page.goto('/login')
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByRole('heading', { name: /sign in|log in|login/i })).toBeVisible({ timeout: 10000 })
  })

  test('unauthenticated user redirected to login from protected route', async ({ page }) => {
    await page.goto('/pages')
    await expect(page).toHaveURL(/\/login/)
  })

  test('unauthenticated user redirected to login from settings', async ({ page }) => {
    await page.goto('/settings')
    await expect(page).toHaveURL(/\/login/)
  })
})
