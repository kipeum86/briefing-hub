import { expect, test } from "@playwright/test";

test.describe("Briefing Hub - page render", () => {
  test("masthead, hero, cards, highlights all present", async ({ page }) => {
    await page.goto("./");
    await expect(page.locator("h1", { hasText: "Briefing Hub" })).toBeVisible();
    await expect(page.locator(".hero h2")).toBeVisible();
    await expect(page.locator(".card").first()).toBeVisible();
    await expect(page.locator(".section-h", { hasText: "This week" })).toBeVisible();
  });

  test("default theme is C", async ({ page }) => {
    await page.goto("./");
    const themeClass = await page.locator("html").getAttribute("class");
    expect(themeClass).toContain("theme-c");
  });
});

test.describe("Briefing Hub - options panel", () => {
  test("gear button toggles the panel open and closed", async ({ page }) => {
    await page.goto("./");
    const panel = page.locator("#optsPanel");

    await expect(panel).toHaveAttribute("aria-hidden", "true");
    await page.locator("#optsToggle").click();
    await expect(panel).toHaveAttribute("aria-hidden", "false");
    await page.locator("#optsToggle").click();
    await expect(panel).toHaveAttribute("aria-hidden", "true");
  });

  test("clicking theme A applies the class and persists across reload", async ({ page }) => {
    await page.goto("./");
    await page.locator("#optsToggle").click();
    await page.locator('.opts-row[data-pref="theme"] label[data-value="a"]').click();

    await expect(page.locator("html")).toHaveClass(/theme-a/);
    await expect(page.locator("html")).not.toHaveClass(/theme-c/);

    await page.reload();
    await expect(page.locator("html")).toHaveClass(/theme-a/);
  });

  test("text size large scales root --scale to 1.15", async ({ page }) => {
    await page.goto("./");
    await page.locator("#optsToggle").click();
    await page.locator('.opts-row[data-pref="size"] label[data-value="large"]').click();

    const scale = await page.locator("html").evaluate((element) =>
      getComputedStyle(element).getPropertyValue("--scale").trim(),
    );
    expect(scale).toBe("1.15");
  });

  test("reset button restores defaults", async ({ page }) => {
    await page.goto("./");
    await page.locator("#optsToggle").click();
    await page.locator('.opts-row[data-pref="theme"] label[data-value="b"]').click();
    await expect(page.locator("html")).toHaveClass(/theme-b/);

    await page.locator("#optsReset").click();
    await expect(page.locator("html")).toHaveClass(/theme-c/);
  });
});
