import { expect, test } from "@playwright/test";

test("renders every protocol role and does not fake deployment evidence", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Sell your next 100 verified API sales/i })).toBeVisible();
  await expect(page.getByText("UNCONFIGURED", { exact: true })).toBeVisible();

  const screens = [
    ["Seller", /Turn bounded sales into runway/i],
    ["Investor", /Fund cashflow—not the company/i],
    ["Customer", /Pay\. Run\. Inspect\. Confirm/i],
    ["Holder", /Own the right\. Keep prior cashflow separate/i],
    ["Proof", /Don’t trust the interface\. Recompute it/i],
  ] as const;

  for (const [tab, heading] of screens) {
    await page.getByRole("button", { name: new RegExp(tab, "i") }).click();
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }
  await expect(page.getByText(/Evidence status:/)).toContainText("not-deployed");
  await expect(page.getByText(/No deployment or transaction is claimed yet/)).toBeVisible();
});
