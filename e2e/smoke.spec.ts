import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Demo mode: no Supabase env, so the app serves the local demo listings.

test("home page renders the hero and search", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Find the right space");
  await expect(page.getByRole("search", { name: /search workspaces/i })).toBeVisible();
});

test("category filter narrows the results on /spaces", async ({ page }) => {
  await page.goto("/spaces");
  const results = page.locator("#results-heading");
  await expect(results).toContainText(/\d+ spaces?/);
  const total = Number((await results.innerText()).match(/\d+/)?.[0] ?? 0);
  expect(total).toBeGreaterThan(1);

  await page.getByRole("button", { name: "Studios", exact: true }).click();
  await expect(results).not.toHaveText(new RegExp(`^${total} spaces`));
  const filtered = Number((await results.innerText()).match(/\d+/)?.[0] ?? 0);
  expect(filtered).toBeLessThan(total);
});

test("a space detail page opens from the list", async ({ page }) => {
  await page.goto("/spaces");
  const firstCardLink = page.locator("article h3 a").first();
  const title = (await firstCardLink.innerText()).trim();
  await firstCardLink.click();
  await expect(page).toHaveURL(/\/spaces\/[^/]+$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  await expect(page.getByRole("button", { name: /request to book|book now/i })).toBeVisible();
});

test("theme choice persists across reloads", async ({ page }) => {
  await page.goto("/");
  const html = page.locator("html");
  const toggle = page.getByRole("button", { name: /switch to (dark|light) theme/i });
  const before = (await html.getAttribute("data-theme")) ?? "light";
  await toggle.click();
  const after = before === "dark" ? "light" : "dark";
  await expect(html).toHaveAttribute("data-theme", after);
  await page.reload();
  await expect(html).toHaveAttribute("data-theme", after);
});

test("mobile menu opens on a phone-sized screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  const menu = page.locator("#mobile-menu");
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("link", { name: "Find a space" })).toBeVisible();
});

test("unknown routes show the 404 page", async ({ page }) => {
  const response = await page.goto("/this-page-does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: /home|spaces/i }).first()).toBeVisible();
});

const A11Y_PAGES = ["/", "/discover", "/spaces", "/spaces/space-1", "/directory/kochi", "/activation", "/activation/track", "/auth/login", "/auth/register"];

for (const path of A11Y_PAGES) {
  for (const theme of ["light", "dark"] as const) {
    test(`no serious accessibility violations on ${path} (${theme})`, async ({ page }) => {
      await page.addInitScript((t) => {
        try {
          localStorage.setItem("spacego-theme", t);
        } catch {}
      }, theme);
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(
        serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length} nodes) e.g. ${v.nodes[0]?.target.join(" ")}`),
      ).toEqual([]);
    });
  }
}
