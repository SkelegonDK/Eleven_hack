import { test, expect } from "@playwright/test";
import { mockAgentsApi } from "./helpers/api-mocks";

test.describe("Start Conversation Error Handling", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should show error message when API call fails", async ({ page }) => {
    // Mock API to return error
    await mockAgentsApi(page, {
      delay: 500,
      status: 500,
      body: { error: "Failed to get agent" },
    });

    // Select a subject
    await page.getByRole("button", { name: /technology/i }).click();

    // Start conversation
    await page.getByRole("button", { name: /start conversation/i }).click();

    // Wait for error to appear
    const errorMessage = page.getByText(/failed/i);
    await expect(errorMessage).toBeVisible({ timeout: 2000 });

    // Verify error UI is displayed (error message should be visible)
    await expect(page.getByText(/failed/i)).toBeVisible();
  });

  test("should show retry button when error occurs", async ({ page }) => {
    // Mock API to return error
    await mockAgentsApi(page, {
      delay: 500,
      status: 500,
      body: { error: "Failed to get agent" },
    });

    // Select a subject and trigger error
    await page.getByRole("button", { name: /technology/i }).click();
    await page.getByRole("button", { name: /start conversation/i }).click();

    // Wait for error
    await expect(page.getByText(/failed/i)).toBeVisible({ timeout: 2000 });

    // Verify retry button is visible
    const retryButton = page.getByRole("button", { name: /retry/i });
    await expect(retryButton).toBeVisible();
    await expect(retryButton).toBeEnabled();
  });

  test("should retry successfully after error", async ({ page }) => {
    // First attempt: mock error
    await mockAgentsApi(page, {
      delay: 300,
      status: 500,
      body: { error: "Failed to get agent" },
    });

    // Select subject and trigger error
    await page.getByRole("button", { name: /technology/i }).click();
    await page.getByRole("button", { name: /start conversation/i }).click();

    // Wait for error
    await expect(page.getByText(/failed/i)).toBeVisible({ timeout: 2000 });

    // Mock successful response for retry
    await mockAgentsApi(page, {
      delay: 800,
      status: 200,
      body: { agentId: "test-agent-retry" },
    });

    // Click retry
    await page.getByRole("button", { name: /retry/i }).click();

    // Verify loading state during retry
    await expect(page.getByText("Connecting...")).toBeVisible();

    // Wait for successful navigation
    await expect(page.getByText(/^(EDU|FUN|DEEP)$/)).toBeVisible({ timeout: 2000 });
  });

  test("should clear error when retrying", async ({ page }) => {
    // Mock error
    await mockAgentsApi(page, {
      delay: 300,
      status: 500,
      body: { error: "Failed to get agent" },
    });

    await page.getByRole("button", { name: /technology/i }).click();
    await page.getByRole("button", { name: /start conversation/i }).click();

    // Wait for error
    await expect(page.getByText(/failed/i)).toBeVisible({ timeout: 2000 });

    // Mock success for retry
    await mockAgentsApi(page, {
      delay: 800,
      status: 200,
      body: { agentId: "test-agent-success" },
    });

    // Retry
    await page.getByRole("button", { name: /retry/i }).click();

    // Error should disappear quickly
    await expect(page.getByText(/failed/i)).not.toBeVisible({ timeout: 500 });
  });
});

