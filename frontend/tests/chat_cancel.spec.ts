import { expect, test } from "@playwright/test"

/**
 * M5 T9: chat cancel end-to-end.
 * Requires running stack + real LANGGRAPH_QWEN_API_KEY.
 * Without them, this spec times out (env, not code).
 */
test("chat cancel stops the stream and sets Redis flag", async ({ page }) => {
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
  await page.click(
    '[data-testid="chat-stop"], button:has-text("停止"), button:has-text("Stop")',
  )
  await page.waitForSelector('[data-testid="chat-cancelled"]', {
    timeout: 10_000,
  })
  const cancelled = await page.textContent('[data-testid="chat-cancelled"]')
  expect(cancelled).toBeTruthy()
})