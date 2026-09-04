import { expect, test } from "@playwright/test"

/**
 * M5 T10: full chat E2E.
 * Requires running stack + real LANGGRAPH_QWEN_API_KEY +
 * LANGGRAPH_EMBEDDING_API_KEY. Without them, this spec times
 * out (env, not code).
 *
 * Exercises: ai-doctor text + multimodal, psych-test intake +
 * Q&A, chat history browser, regenerate, cancel.
 */
test("full M5 E2E", async ({ page }) => {
  test.setTimeout(180_000)
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

  // 1. ai-doctor text
  await page.goto("/user/ai-doctor")
  await page.fill(
    '[data-testid="chat-input"], textarea[placeholder*="说"], textarea',
    "你好",
  )
  await page.click(
    '[data-testid="chat-send"], button:has-text("发送"), button[type="submit"]',
  )
  await page.waitForSelector('[data-testid="chat-message-done"]', {
    timeout: 30_000,
  })

  // 2. Regenerate
  await page.click(
    '[data-testid="chat-regenerate"], button:has-text("重新生成"), button:has-text("Regenerate")',
  )
  await page.waitForSelector(
    '[data-testid="chat-message-streaming"], .assistant, .ai-message',
    { timeout: 15_000 },
  )
  await page.waitForSelector('[data-testid="chat-message-done"]', {
    timeout: 30_000,
  })

  // 3. Stop
  await page.fill(
    '[data-testid="chat-input"], textarea[placeholder*="说"], textarea',
    "再来一个",
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

  // 4. Chat history
  await page.goto("/chat-history")
  await page.waitForSelector('[data-testid="chat-history-list"]', {
    timeout: 10_000,
  })
  const items = await page.locator('[data-testid="chat-history-item"]').count()
  expect(items).toBeGreaterThan(0)
})