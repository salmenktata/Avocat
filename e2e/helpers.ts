import { Page, expect } from '@playwright/test'

/**
 * Helper functions for E2E tests
 */

/**
 * Login to the application
 */
export async function login(page: Page, email?: string, password?: string) {
  await page.goto('/login')
  await page.fill('input[name="email"]', email || process.env.TEST_USER_EMAIL || 'test@example.com')
  await page.fill('input[name="password"]', password || process.env.TEST_USER_PASSWORD || 'testpassword123')
  await page.click('button[type="submit"]')
  await page.waitForURL('/dashboard', { timeout: 10000 })
}

/**
 * Navigate to a page and wait for it to load
 */
export async function navigateTo(page: Page, path: string) {
  await page.goto(path)
  await page.waitForLoadState('networkidle')
}

/**
 * Wait for a toast notification and verify its content
 */
export async function expectToast(page: Page, message: string) {
  const toast = page.locator('.toast, [role="alert"]').filter({ hasText: message })
  await expect(toast).toBeVisible({ timeout: 5000 })
}

/**
 * Fill a form field by label
 */
export async function fillField(page: Page, label: string, value: string) {
  const field = page.locator(`label:has-text("${label}") + input, label:has-text("${label}") + textarea`)
  await field.fill(value)
}

/**
 * Select an option from a dropdown by label
 */
export async function selectOption(page: Page, label: string, value: string) {
  const select = page.locator(`label:has-text("${label}") + select`)
  await select.selectOption(value)
}

/**
 * Click a button by text
 */
export async function clickButton(page: Page, text: string) {
  await page.click(`button:has-text("${text}")`)
}

/**
 * Wait for page to be fully loaded
 */
export async function waitForPageLoad(page: Page) {
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(500) // Small delay for React hydration
}

/**
 * Format date to ISO string (YYYY-MM-DD)
 */
export function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0]
}

/**
 * Get date N days ago
 */
export function daysAgo(days: number): Date {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date
}

/**
 * Get date N days from now
 */
export function daysFromNow(days: number): Date {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date
}
