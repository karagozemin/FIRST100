import { expect, test } from "@playwright/test";

test("renders the product landing and opens the live application", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute("href", "/first100-logo.png");
  await expect(page.locator(".brand-mark img").first()).toHaveCSS("object-fit", "contain");
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

  await page.getByRole("button", { name: "Customer" }).click();
  await page.route("https://rpc.testnet.near.org/**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.continue();
  });
  const quote = page.getByRole("button", { name: /Get quote/i });
  await quote.click();
  await expect(quote).toHaveAttribute("aria-busy", "true");
  await expect(page.getByRole("status")).toContainText("PROCESSING");
});

test("offers supported NEAR wallets", async ({ page }) => {
  await page.goto("/app");
  await page.getByRole("button", { name: "Connect wallet" }).click();

  await expect(page.getByRole("heading", { name: "Connect Your Wallet" })).toBeVisible();
  await expect(page.getByText("Meteor Wallet", { exact: true })).toBeVisible();
  await expect(page.getByText("Nightly", { exact: true })).toBeVisible();
  await expect(page.getByText("Sender", { exact: true })).toBeVisible();
  await expect(page.getByText("HOT Wallet", { exact: true })).toBeVisible();
  await expect(page.getByText("Intear Wallet", { exact: true })).toBeVisible();
  await expect(page.getByText("OKX Wallet", { exact: true })).toBeVisible();
  await expect(page.locator(".single-wallet.sidebar.meteor-wallet .first100-wallet-status")).toHaveText("INSTALL");
  await expect(page.locator(".single-wallet.sidebar.nightly .first100-wallet-status")).toHaveText("INSTALL");
  await expect(page.locator(".single-wallet.sidebar.sender .first100-wallet-status")).toHaveText("INSTALL");
  await expect(page.locator(".single-wallet.sidebar.hot-wallet .first100-wallet-status")).toHaveText("WEB");
  await expect(page.locator(".single-wallet.sidebar.intear-wallet .first100-wallet-status")).toHaveText("WEB");
  await expect(page.locator(".first100-wallet-status[data-status=ready]")).toHaveCount(0);
  const installTargets = await page.locator('.single-wallet.sidebar[data-wallet-status="install"]').evaluateAll((rows) =>
    rows.map((row) => (row as HTMLElement).dataset.installUrl),
  );
  expect(installTargets.length).toBeGreaterThan(0);
  expect(installTargets.every((url) => url?.startsWith("https://"))).toBe(true);
  await expect(page.getByText("MyNearWallet", { exact: true })).toHaveCount(0);
});

test("opens the official install page for a missing extension", async ({ page }) => {
  await page.goto("/app");
  await page.getByRole("button", { name: "Connect wallet" }).click();

  const meteor = page.locator(".single-wallet.sidebar.meteor-wallet");
  await expect(meteor).toHaveAttribute(
    "data-install-url",
    "https://chromewebstore.google.com/detail/meteor-wallet/pcndjhkinnkaohffealmlmhaepkpmgkb",
  );
  const popupPromise = page.waitForEvent("popup");
  await meteor.click();
  const popup = await popupPromise;
  await expect.poll(() => popup.url()).toContain("chromewebstore.google.com/detail/meteor-wallet/");
  await popup.close();
});

test("marks an injected Meteor extension as ready", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "meteorCom", { value: {}, configurable: true });
  });
  await page.goto("/app");
  await page.getByRole("button", { name: "Connect wallet" }).click();

  await expect(page.locator(".single-wallet.sidebar.meteor-wallet .first100-wallet-status")).toHaveText("READY");
});
