import { expect, test } from "@playwright/test";

test("renders the submission landing page and keeps the app in coming-soon state", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Finance the first 100 sales/i })).toBeVisible();
  await expect(page.getByText("NOT AN ACTIVE OFFER", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Built to be checked/i })).toBeVisible();
  await expect(page.getByText("LIVE TESTNET EVIDENCE", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Open contract/i })).toHaveAttribute(
    "href",
    "https://explorer.testnet.near.org/accounts/first100-v2-20261115.testnet",
  );
  await page.getByRole("link", { name: "App" }).click();
  await expect(page.getByRole("heading", { name: /dashboard is being prepared/i })).toBeVisible();
  await expect(page.getByText("COMING SOON", { exact: true })).toHaveCount(2);
  await expect(page.getByText(/No wallet connection is active/)).toBeVisible();
});
