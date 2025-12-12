import { test, expect } from "@playwright/test";
import { setupApiMocks } from "./helpers/api-mocks";

test.describe("Start Conversation Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Setup API mocks with realistic latency
    await setupApiMocks(page, { agentsDelay: 1200 });
    await page.goto("/");
  });

  test("should show loading state quickly after clicking play button", async ({
    page,
  }) => {
    // Select a subject first
    const techSubject = page.getByRole("button", { name: /technology/i });
    await techSubject.click();

    // Click the play button
    const playButton = page.getByRole("button", { name: /start conversation/i });
    const clickTime = Date.now();
    await playButton.click();

    // Assert loading state appears quickly (within 100ms)
    const loadingText = page.getByText("Connecting...");
    await expect(loadingText).toBeVisible({ timeout: 200 });
    const loadingAppearedTime = Date.now();
    expect(loadingAppearedTime - clickTime).toBeLessThan(200);

    // Assert button is disabled during loading
    await expect(playButton).toBeDisabled();
  });

  test("should navigate to conversation view after successful API call", async ({
    page,
  }) => {
    // Select a subject
    await page.getByRole("button", { name: /technology/i }).click();

    // Start conversation
    await page.getByRole("button", { name: /start conversation/i }).click();

    // Wait for conversation view to appear (after API call completes)
    // Look for the mode badge (EDU/FUN/DEEP)
    const modeBadge = page.getByText(/^(EDU|FUN|DEEP)$/);
    await expect(modeBadge).toBeVisible({ timeout: 2000 });

    // Verify we're in conversation view
    await expect(page.getByText(/Ready to start|Listening|Connecting/i)).toBeVisible();
  });

  test("should handle touch interactions on mobile", async ({ page, isMobile }) => {
    test.skip(!isMobile, "This test is for mobile devices only");

    // Select a subject using touch
    const techSubject = page.getByRole("button", { name: /technology/i });
    await techSubject.tap();

    // Tap the play button
    const playButton = page.getByRole("button", { name: /start conversation/i });
    await playButton.tap();

    // Assert loading state appears
    await expect(page.getByText("Connecting...")).toBeVisible({ timeout: 200 });

    // Wait for conversation view
    await expect(page.getByText(/^(EDU|FUN|DEEP)$/)).toBeVisible({ timeout: 2000 });
  });
});

