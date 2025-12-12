import { Page, Route } from "@playwright/test";

/**
 * Helper to mock API routes with controllable latency
 */
export interface MockApiOptions {
  delay?: number; // Delay in milliseconds
  status?: number;
  body?: any;
}

/**
 * Mock the /api/agents POST endpoint
 */
export async function mockAgentsApi(
  page: Page,
  options: MockApiOptions = {}
): Promise<void> {
  const { delay = 0, status = 200, body = { agentId: "test-agent-123" } } = options;

  await page.route("**/api/agents", async (route: Route) => {
    if (route.request().method() === "POST") {
      await new Promise((resolve) => setTimeout(resolve, delay));
      await route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    } else {
      await route.continue();
    }
  });
}

/**
 * Mock the /api/documents POST endpoint (file upload)
 */
export async function mockDocumentsUploadApi(
  page: Page,
  options: MockApiOptions = {}
): Promise<void> {
  const {
    delay = 0,
    status = 200,
    body = {
      id: `doc-${Date.now()}`,
      name: "test-document.txt",
      uploadedAt: new Date().toISOString(),
    },
  } = options;

  await page.route("**/api/documents", async (route: Route) => {
    if (route.request().method() === "POST") {
      await new Promise((resolve) => setTimeout(resolve, delay));
      await route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    } else {
      await route.continue();
    }
  });
}

/**
 * Mock the /api/documents/:id DELETE endpoint
 */
export async function mockDocumentsDeleteApi(
  page: Page,
  options: MockApiOptions = {}
): Promise<void> {
  const { delay = 0, status = 200, body = { success: true } } = options;

  await page.route("**/api/documents/*", async (route: Route) => {
    if (route.request().method() === "DELETE") {
      await new Promise((resolve) => setTimeout(resolve, delay));
      await route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    } else {
      await route.continue();
    }
  });
}

/**
 * Setup all API mocks with default latency
 */
export async function setupApiMocks(
  page: Page,
  options: {
    agentsDelay?: number;
    uploadDelay?: number;
    deleteDelay?: number;
  } = {}
): Promise<void> {
  await mockAgentsApi(page, { delay: options.agentsDelay ?? 1200 });
  await mockDocumentsUploadApi(page, { delay: options.uploadDelay ?? 800 });
  await mockDocumentsDeleteApi(page, { delay: options.deleteDelay ?? 300 });
}

