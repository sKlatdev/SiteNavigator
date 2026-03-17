import { expect, test } from "@playwright/test";

const acceptPrompt = (page, value) => {
  page.once("dialog", async (dialog) => {
    await dialog.accept(value);
  });
};

const openExplorer = async (page) => {
  await page.getByLabel("Open Explorer").click();
  await expect(page.getByLabel("Search site content")).toBeVisible();
};

test.describe("Keyboard walkthrough automation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("slash focuses global search", async ({ page }) => {
    await openExplorer(page);
    await page.locator("body").click();
    await page.keyboard.press("Slash");
    await expect(page.getByLabel("Search site content")).toBeFocused();
  });

  test("mobile drawer traps tab focus", async ({ page }) => {
    await openExplorer(page);
    await page.setViewportSize({ width: 390, height: 844 });

    const navToggle = page.getByLabel("Open navigation");
    if (await navToggle.count()) {
      await navToggle.click();
    }

    await expect(page.getByLabel("Primary navigation")).toBeVisible();

    for (let i = 0; i < 14; i += 1) {
      await page.keyboard.press("Tab");
    }

    const withinDrawer = await page.evaluate(() => {
      const active = document.activeElement;
      return !!active?.closest("#primary-navigation");
    });
    expect(withinDrawer).toBeTruthy();

    await page.keyboard.press("Escape");

    if (await navToggle.count()) {
      await expect(navToggle).toHaveAttribute("aria-expanded", "false");
    }
  });

  test("template confirm modal traps focus and closes with escape", async ({ page }) => {
    await page.getByLabel("Open Manage Customers").click();
    await page.getByRole("button", { name: "Templates" }).click();

    const templateName = `PW Modal Template ${Date.now()}`;
    await page.getByRole("button", { name: "Create Template" }).click();
    await page.locator("#create-template-name").fill(templateName);
    await page.getByRole("button", { name: "Save Template" }).click();

    const cards = page.locator(".glass-surface.p-4");
    const targetCard = cards.filter({ hasText: templateName }).first();
    await targetCard.getByRole("button", { name: "Delete" }).click();

    await expect(page.getByRole("heading", { name: "Delete template?" })).toBeVisible();

    for (let i = 0; i < 8; i += 1) {
      await page.keyboard.press("Tab");
    }

    const inDialog = await page.evaluate(() => {
      const active = document.activeElement;
      return !!active?.closest('[role="dialog"]');
    });
    expect(inDialog).toBeTruthy();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { name: "Delete template?" })).toBeHidden();
  });

  test("pinned filters support apply rename and delete inline", async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem(
        "sn_pinned_filters",
        JSON.stringify([
          {
            id: "pin_e2e",
            label: "E2E Pin",
            view: "explorer",
            query: "duo",
            explorerCategory: "",
            contentPageSize: 50,
            recentDaysWindow: 14,
          },
        ])
      );
    });
    await page.reload();
    await openExplorer(page);

    await page.getByLabel("Apply pinned filter E2E Pin").click();
    await expect(page.getByLabel("Search site content")).toHaveValue("duo");

    acceptPrompt(page, "E2E Pin Renamed");
    await page.getByLabel("Rename pinned filter E2E Pin").click();
    await expect(page.getByLabel("Apply pinned filter E2E Pin Renamed")).toBeVisible();

    await page.getByLabel("Delete pinned filter E2E Pin Renamed").click();
    await expect(page.getByLabel("Apply pinned filter E2E Pin Renamed")).toBeHidden();
  });

  test("customer modal supports template status updates", async ({ page }) => {
    await page.getByLabel("Open Manage Customers").click();
    await page.getByRole("button", { name: "Customers", exact: true }).click();
    await page.getByLabel("Open customer Acme Corp").click();

    const customerDialog = page.getByRole("dialog", { name: /Customer: Acme Corp/ });
    const firstStatusSelect = customerDialog.getByRole("combobox").first();
    await firstStatusSelect.selectOption("implemented");
    await expect(firstStatusSelect).toHaveValue("implemented");
  });

  test("pin current search adds removable filter chip", async ({ page }) => {
    await openExplorer(page);
    await page.getByLabel("Search site content").fill("duo");
    await page.getByLabel("Pin current search as tag").click();

    const removeFilterButton = page.getByRole("button", { name: /Remove .* filter/ }).first();
    await expect(removeFilterButton).toBeVisible();
    await removeFilterButton.click();
    await expect(page.getByRole("button", { name: /Remove .* filter/ })).toHaveCount(0);
  });
});
