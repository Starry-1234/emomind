import { expect, test } from "@playwright/test"

/**
 * M5 T9: regenerate button creates a new version.
 * Requires running stack + real LANGGRAPH_QWEN_API_KEY.
 */
test("regenerate creates a new version while keeping old", async ({ page }) => {
  test.setTimeout(60_000)
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

  await page.goto("/user/ai-doctor")
  await page.fill(
    '[data-testid="chat-input"], textarea[placeholder*="说"], textarea',
    "你好",
  )
  await page.click(
    '[data-testid="chat-send"], button:has-text("发送"), button[type="submit"]',
  )
  await page.waitForSelector(
    '[data-testid="chat-message-streaming"], .assistant, .ai-message',
    { timeout: 15_000 },
  )
  await page.waitForSelector('[data-testid="chat-message-done"]', {
    timeout: 30_000,
  })
  await page.click(
    '[data-testid="chat-regenerate"], button:has-text("重新生成"), button:has-text("Regenerate")',
  )
  await page.waitForSelector(
    '[data-testid="chat-message-streaming"], .assistant, .ai-message',
    { timeout: 15_000 },
  )
  const versions = await page.locator('[data-testid="chat-version"]').count()
  expect(versions).toBeGreaterThanOrEqual(2)
})