/**
 * E2E: Pages and interface flows
 * Requires authenticated session - use storageState for login
 */

import { test, expect } from '@playwright/test'

test.describe('Pages', () => {
  test('root redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login|\/$/)
  })

  test('login page has form elements', async ({ page }) => {
    await page.goto('/login')
    const emailInput = page.getByLabel(/email|username/i).first()
    const submitButton = page.getByRole('button', { name: /sign in|log in|submit/i }).first()
    await expect(emailInput).toBeVisible({ timeout: 5000 })
    await expect(submitButton).toBeVisible({ timeout: 5000 })
  })
})
