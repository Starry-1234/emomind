import { expect, test } from "@playwright/test"

/**
 * M4 verification: psych_test flow with persistence.
 *
 * Login -> /user/test -> intake -> Q&A loop -> report with real
 * test_record_id persisted to Spring (via ai-runtime
 * persist_test_record -> POST /api/v1/test-records).
 *
 * Prerequisite: stack is up (docker compose: Spring + ai-runtime +
 * Postgres with pgvector + Redis) AND a real
 * LANGGRAPH_QWEN_API_KEY + LANGGRAPH_EMBEDDING_API_KEY.
 *
 * Without those, the spec times out (env issue, not code).
 * Mirrors M3's multimodal-upload.spec.ts pattern.
 */

test("psych_test_persistence_flow", async ({ page }) => {
  test.setTimeout(60_000)
  await page.goto("/login")
  await page.fill('input[name="email"], input[type="email"]', "admin@example.com")
  await page.fill('input[name="password"], input[type="password"]', "changethis")
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/user/, { timeout: 10_000 })

  await page.goto("/user/test")
  await expect(page).toHaveURL(/\/user\/test/)

  // The new TestIntake component (M4)
  await page.fill(
    'textarea[data-testid="test-intake-textarea"]',
    "我最近心情低落、失眠",
  )
  await page.click('button[data-testid="test-intake-submit"]')

  // Wait for first question to appear
  await page.waitForSelector('[data-testid="test-question-text"]', {
    timeout: 30_000,
  })

  // Answer 5 questions (mock scoring; 2 = 有时)
  for (let i = 0; i < 5; i++) {
    await page.click('button[data-testid="test-question-score-2"]')
    await page.click('button[data-testid="test-question-submit"]')
    if (i < 4) {
      await page.waitForSelector('[data-testid="test-question-text"]', {
        timeout: 15_000,
      })
    }
  }

  // Report with persisted test_record_id
  await page.waitForSelector('[data-testid="test-report-stored-record-id"]', {
    timeout: 30_000,
  })
  const recordId = await page.textContent(
    '[data-testid="test-report-stored-record-id"]',
  )
  expect(recordId).toBeTruthy()
  // Real record_id is a UUID, not the "stub-{uuid}" frontend fallback
  // (which only fires when Spring is unreachable)
  expect(recordId).not.toMatch(/^stub-/)
})