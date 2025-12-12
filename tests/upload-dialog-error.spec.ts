import { test, expect } from "@playwright/test";
import { mockDocumentsUploadApi } from "./helpers/api-mocks";
import path from "path";

test.describe("Upload Dialog Error Handling", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should show error message when upload fails", async ({ page }) => {
    // Mock upload API to return error
    await mockDocumentsUploadApi(page, {
      delay: 500,
      status: 500,
      body: { error: "Failed to upload document" },
    });

    // Open upload dialog
    await page.getByRole("button", { name: /upload document/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "error-test.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Test content"),
    });

    // Wait for error state
    await expect(page.getByText("error-test.txt")).toBeVisible({ timeout: 1000 });

    // Verify error message is displayed
    const errorText = page.getByText("Upload failed");
    await expect(errorText).toBeVisible({ timeout: 1500 });

    // Verify error icon is shown
    const errorIcon = page.locator('[class*="text-destructive"]').first();
    await expect(errorIcon).toBeVisible();
  });

  test("should show error per file when multiple uploads fail", async ({
    page,
  }) => {
    // Mock error response
    await mockDocumentsUploadApi(page, {
      delay: 400,
      status: 500,
      body: { error: "Upload failed" },
    });

    // Open dialog
    await page.getByRole("button", { name: /upload document/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Upload multiple files
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([
      {
        name: "error1.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("Error 1"),
      },
      {
        name: "error2.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("Error 2"),
      },
    ]);

    // Verify both files show error
    await expect(page.getByText("error1.txt")).toBeVisible({ timeout: 1000 });
    await expect(page.getByText("error2.txt")).toBeVisible({ timeout: 1000 });

    // Verify error messages for both
    const errorMessages = page.getByText("Upload failed");
    await expect(errorMessages.first()).toBeVisible({ timeout: 1500 });
    await expect(errorMessages.nth(1)).toBeVisible({ timeout: 1500 });
  });

  test("should maintain error state until file is removed", async ({
    page,
  }) => {
    // Mock error
    await mockDocumentsUploadApi(page, {
      delay: 500,
      status: 500,
      body: { error: "Upload failed" },
    });

    // Open and upload
    await page.getByRole("button", { name: /upload document/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "persistent-error.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Error"),
    });

    // Wait for error
    await expect(page.getByText("Upload failed")).toBeVisible({ timeout: 1500 });

    // Error should persist
    await expect(page.getByText("Upload failed")).toBeVisible();

    // Remove file
    const removeButton = page.getByRole("button", {
      name: /remove persistent-error\.txt/i,
    });
    await removeButton.click();

    // Error should be gone
    await expect(page.getByText("Upload failed")).not.toBeVisible();
  });
});

