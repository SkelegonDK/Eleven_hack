import { test, expect } from "@playwright/test";
import { setupApiMocks, mockDocumentsDeleteApi } from "./helpers/api-mocks";
import path from "path";

test.describe("Upload Dialog Flow", () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page, { uploadDelay: 800, deleteDelay: 300 });
    await page.goto("/");
  });

  test("should open upload dialog when clicking upload subject", async ({
    page,
  }) => {
    // Click the upload document button
    const uploadButton = page.getByRole("button", { name: /upload document/i });
    await uploadButton.click();

    // Verify dialog is open
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText("Upload Documents")).toBeVisible();
  });

  test("should show uploading state immediately after file selection", async ({
    page,
  }) => {
    // Open upload dialog
    await page.getByRole("button", { name: /upload document/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Create a test file
    const testFilePath = path.join(__dirname, "fixtures", "test-document.txt");
    
    // Set up file input
    const fileInput = page.locator('input[type="file"]');
    
    // Upload file
    await fileInput.setInputFiles({
      name: "test-document.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Test document content"),
    });

    // Assert uploading state appears quickly
    const uploadingIndicator = page.locator('[class*="animate-spin"]').first();
    await expect(uploadingIndicator).toBeVisible({ timeout: 200 });

    // Verify file name is shown
    await expect(page.getByText("test-document.txt")).toBeVisible();
  });

  test("should show success state after upload completes", async ({ page }) => {
    // Open dialog
    await page.getByRole("button", { name: /upload document/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "test-success.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Test content"),
    });

    // Wait for success state (after mock delay)
    await expect(page.getByText("test-success.txt")).toBeVisible();
    
    // Check for success icon (CheckCircle2)
    const successIcon = page.locator('[class*="text-green-500"]').first();
    await expect(successIcon).toBeVisible({ timeout: 1500 });
  });

  test("should remove document when clicking remove button", async ({
    page,
  }) => {
    // Open dialog and upload
    await page.getByRole("button", { name: /upload document/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "test-remove.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Test content"),
    });

    // Wait for upload to complete
    await expect(page.getByText("test-remove.txt")).toBeVisible({ timeout: 1500 });

    // Click remove button
    const removeButton = page.getByRole("button", { name: /remove test-remove\.txt/i });
    await removeButton.click();

    // Verify document is removed from UI
    await expect(page.getByText("test-remove.txt")).not.toBeVisible({ timeout: 1000 });
  });

  test("should handle touch interactions for file upload", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "This test is for mobile devices only");

    // Open dialog with touch
    await page.getByRole("button", { name: /upload document/i }).tap();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Tap upload zone
    const uploadZone = page.getByText("Drop files or tap to upload");
    await uploadZone.tap();

    // Upload file (simulated)
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "mobile-test.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Mobile test"),
    });

    // Verify upload state
    await expect(page.getByText("mobile-test.txt")).toBeVisible({ timeout: 1500 });
  });

  test("should handle multiple file uploads", async ({ page }) => {
    // Open dialog
    await page.getByRole("button", { name: /upload document/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Upload multiple files
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([
      {
        name: "file1.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("File 1"),
      },
      {
        name: "file2.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("File 2"),
      },
    ]);

    // Verify both files appear
    await expect(page.getByText("file1.txt")).toBeVisible({ timeout: 1500 });
    await expect(page.getByText("file2.txt")).toBeVisible({ timeout: 1500 });
  });
});

