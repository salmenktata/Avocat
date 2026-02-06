import { test as setup, expect } from '@playwright/test'
import path from 'path'

const authFile = path.join(__dirname, '../.playwright/auth.json')

/**
 * Setup authentication state for E2E tests
 * This runs once before all tests and saves the auth state
 */
setup('authenticate', async ({ page }) => {
  // Navigate to login page
  await page.goto('/login')

  // Fill login form with test credentials
  await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL || 'test@example.com')
  await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD || 'testpassword123')

  // Submit form
  await page.click('button[type="submit"]')

  // Wait for redirect to dashboard
  await page.waitForURL('/dashboard', { timeout: 10000 })

  // Verify we're logged in
  await expect(page.locator('text=Tableau de bord')).toBeVisible()

  // Save authentication state
  await page.context().storageState({ path: authFile })
})
