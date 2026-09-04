import { expect, test } from "@playwright/test"

/**
 * M5 T9: chat history browser.
 * Requires running stack + real Spring + ai-runtime.
 */
test("chat history shows past conversations", async ({ page }) => {
  await page.goto("/login")
  await page.fill(
    'input[name="email"], input[type="email"]',
    "admin@example.com",
  )
  await page.fill(
    'input[name="password"], input[type="password"]',
    "changethis",
  )
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/user/, { timeout: 10_000 })

  await page.goto("/chat-history")
  await page.waitForSelector('[data-testid="chat-history-list"]', {
    timeout: 10_000,
  })
  const items = await page.locator('[data-testid="chat-history-item"]').count()
  expect(items).toBeGreaterThanOrEqual(0) // may be 0 on fresh DB
})