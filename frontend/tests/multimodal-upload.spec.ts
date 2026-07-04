import { expect, test } from "@playwright/test"

/**
 * M2 verification: login, upload an image, send a multimodal message,
 * watch the streamed assistant response land in the UI.
 *
 * Prerequisite: stack is up (docker compose), superuser exists
 * (FIRST_SUPERUSER=admin@example.com / FIRST_SUPERUSER_PASSWORD=changethis).
 * This spec mirrors M1's chat-streaming.spec.ts but exercises the
 * multimodal upload + Send API path.
 */

test("multimodal upload + analysis streams a response", async ({ page }) => {
  await page.goto("/login")
  await page.fill('input[name="email"], input[type="email"]', "admin@example.com")
  await page.fill('input[name="password"], input[type="password"]', "changethis")
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/user/, { timeout: 10_000 })

  await page.goto("/user/ai-doctor")
  await expect(page).toHaveURL(/\/user\/ai-doctor/)

  // The M2 multimodal UI has an "分析" / "上传档案" button; click it
  await page.click('button:has-text("分析"), button:has-text("上传")')

  // Upload a file via the file input
  const fileInput = page.locator('input[type="file"]')
  // Use a tiny pre-baked PNG (1x1 transparent pixel)
  const tinyPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=",
    "base64"
  )
  await fileInput.setInputFiles({
    name: "pixel.png",
    mimeType: "image/png",
    buffer: tinyPng,
  })

  // Submit analysis
  await page.click('button:has-text("开始分析"), button[type="submit"]')

  // Wait for the result view (redirect on completion)
  await page.waitForURL(/\/user\/ai-doctor\/chat\//, { timeout: 30_000 })
  const report = page.locator('[data-testid="report"], .report, .analysis')
  await expect(report).toBeVisible({ timeout: 10_000 })
})