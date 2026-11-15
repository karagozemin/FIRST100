import { expect, test } from "@playwright/test";

test("renders the product landing and opens the live application", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Finance the first 100 sales/i })).toBeVisible();
  await expect(page.getByText("NOT AN ACTIVE OFFER", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Built to be checked/i })).toBeVisible();
  await expect(page.getByText("LIVE TESTNET EVIDENCE", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Open contract/i })).toHaveAttribute(
    "href",
    "https://explorer.testnet.near.org/accounts/first100-v2-20261115.testnet",
  );
  await expect(page.getByText("LIVE ON TESTNET", { exact: true })).toBeVisible();
  await expect(page.locator(".dashboard-lock")).toHaveCount(0);
  await page.getByRole("link", { name: "App", exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("heading", { name: /Operate the revenue right/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect wallet" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "FIRST100 workflows" })).toBeVisible();
  await expect(page.getByText("first100-v2-20261115.testnet", { exact: true })).toBeVisible();
});
