import { test, expect } from "@playwright/test";
import { mockAgentsApi, mockAgentsApiError, mockConfigApi } from "./helpers/api-mocks";

test.describe("Start Conversation Error Handling", () => {
  test.beforeEach(async ({ page }) => {
    // /api/config gates the whole app (LandingPage pre-flights it in
    // handleStart and canStart disables the play button without it), so it
    // must be mocked before the initial navigation, not inside the test body.
    await mockConfigApi(page);
    await page.goto("/");
  });

  test("should show error message when API call fails", async ({ page }) => {
    // Mock API to return error
    await mockAgentsApiError(page, {
      delay: 500,
      status: 500,
      error: "Failed to get agent",
      code: "upstream_error",
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
    await mockAgentsApiError(page, {
      delay: 500,
      status: 500,
      error: "Failed to get agent",
      code: "upstream_error",
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
    await mockAgentsApiError(page, {
      delay: 300,
      status: 500,
      error: "Failed to get agent",
      code: "upstream_error",
    });

    // Select subject and trigger error
    await page.getByRole("button", { name: /technology/i }).click();
    await page.getByRole("button", { name: /start conversation/i }).click();

    // Wait for error
    await expect(page.getByText(/failed/i)).toBeVisible({ timeout: 2000 });

    // Mock successful response for retry - real route always returns
    // { agentId, systemPrompt, firstMessage } (see src/api/agents.ts
    // getAgentForMode), so the mock must match that full shape.
    await mockAgentsApi(page, {
      delay: 800,
      status: 200,
      body: {
        agentId: "test-agent-retry",
        systemPrompt: "You are the host of PODU, an interactive podcast.",
        firstMessage: "Welcome to PODU! What would you like to talk about?",
      },
    });

    // Click retry
    await page.getByRole("button", { name: /retry/i }).click();

    // Verify loading state during retry
    await expect(page.getByText("Connecting...")).toBeVisible({ timeout: 1000 });

    // Wait for successful navigation (give more time for webkit)
    await expect(page.getByTestId("conversation-mode-badge")).toBeVisible({ timeout: 3000 });
  });

  test("should clear error when retrying", async ({ page }) => {
    // Mock error
    await mockAgentsApiError(page, {
      delay: 300,
      status: 500,
      error: "Failed to get agent",
      code: "upstream_error",
    });

    await page.getByRole("button", { name: /technology/i }).click();
    await page.getByRole("button", { name: /start conversation/i }).click();

    // Wait for error
    await expect(page.getByText(/failed/i)).toBeVisible({ timeout: 2000 });

    // Mock success for retry - complete payload (see comment above).
    await mockAgentsApi(page, {
      delay: 800,
      status: 200,
      body: {
        agentId: "test-agent-success",
        systemPrompt: "You are the host of PODU, an interactive podcast.",
        firstMessage: "Welcome to PODU! What would you like to talk about?",
      },
    });

    // Retry
    await page.getByRole("button", { name: /retry/i }).click();

    // Error should disappear quickly
    await expect(page.getByText(/failed/i)).not.toBeVisible({ timeout: 500 });
  });
});
