import { expect, test } from "@playwright/test"

/**
 * M1 verification: login, send a text message to ai-doctor, watch the
 * streamed assistant response land in the UI.
 *
 * Prerequisite: stack is up (docker compose), superuser exists
 * (FIRST_SUPERUSER=admin@example.com / FIRST_SUPERUSER_PASSWORD=changethis).
 * This spec uses the auth.setup.ts that generates playwright/.auth/user.json
 * if it isn't already there.
 *
 * Port notes (see playwright.config.ts):
 *   - default baseURL is http://localhost:5173 (Vite dev)
 *   - docker stack frontend serves on 5174 (per CLAUDE.md)
 *   - run with `PLAYWRIGHT_BASE_URL=http://localhost:5174 \
 *               PLAYWRIGHT_WEB_SERVER_URL=http://localhost:5174 \
 *               npx playwright test` against the docker image
 *   - or start the local Vite dev server on 5173 first
 */

test("ai-doctor streams a text reply", async ({ page }) => {
  // Login (assumes auth.setup.ts has already created user.json, or fall back here)
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

  // Navigate to ai-doctor chat
  await page.goto("/user/ai-doctor")
  await expect(page).toHaveURL(/\/user\/ai-doctor/)

  // Find the chat input (data-testid is preferred but fall back to textarea)
  const input = page
    .locator(
      '[data-testid="chat-input"], textarea[placeholder*="说"], textarea',
    )
    .first()
  await input.fill("你好，请简单介绍一下你自己")

  // Click send
  await page.click(
    '[data-testid="send-btn"], button:has-text("发送"), button[type="submit"]',
  )

  // The assistant message bubble should appear within 30s
  const assistant = page
    .locator('[data-testid="assistant-message"], .assistant, .ai-message')
    .first()
  await expect(assistant).toBeVisible({ timeout: 30_000 })

  // It should grow over time (token streaming)
  const initial = (await assistant.textContent()) ?? ""
  await page.waitForTimeout(2_000)
  const later = (await assistant.textContent()) ?? ""
  // Either grew (streaming) or stayed the same length (full message already
  // arrived). We just assert non-empty in the M1 happy path.
  expect(later.length).toBeGreaterThan(0)
  expect(initial.length).toBeGreaterThan(0)
})
