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

    // Get the play button using test-id (more stable than aria-label which changes)
    const playButton = page.getByTestId("play-button");
    const clickTime = Date.now();
    
    // Click the button
    await playButton.click();
    
    // Assert loading state appears quickly (within 300ms)
    const loadingText = page.getByText("Connecting...");
    await expect(loadingText).toBeVisible({ timeout: 300 });
    const loadingAppearedTime = Date.now();
    expect(loadingAppearedTime - clickTime).toBeLessThan(300);

    // Assert button is disabled during loading
    // The button should still exist (using test-id) and be disabled
    await expect(playButton).toBeDisabled({ timeout: 500 });
  });

  test("should navigate to conversation view after successful API call", async ({
    page,
  }) => {
    // Select a subject
    await page.getByRole("button", { name: /technology/i }).click();

    // Start conversation
    await page.getByRole("button", { name: /start conversation/i }).click();

    // Wait for conversation view to appear (after API call completes)
    // Look for the mode badge using data-testid
    const modeBadge = page.getByTestId("conversation-mode-badge");
    await expect(modeBadge).toBeVisible({ timeout: 3000 });

    // Verify we're in conversation view - check for status text
    await expect(page.getByText(/Ready to start|Listening|Connecting|Host is speaking/i)).toBeVisible({ timeout: 1000 });
  });

  test("should handle touch interactions on mobile", async ({ page, isMobile }) => {
    test.skip(!isMobile, "This test is for mobile devices only");

    // Select a subject using touch
    const techSubject = page.getByRole("button", { name: /technology/i });
    await techSubject.tap();

    // Tap the play button using test-id (more stable than aria-label)
    const playButton = page.getByTestId("play-button");
    await playButton.tap();

    // Assert loading state appears
    await expect(page.getByText("Connecting...")).toBeVisible({ timeout: 300 });

    // Wait for conversation view
    await expect(page.getByTestId("conversation-mode-badge")).toBeVisible({ timeout: 3000 });
  });
});

