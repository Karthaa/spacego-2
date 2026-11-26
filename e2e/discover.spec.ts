import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Demo mode (no Supabase env): /discover searches the local sample listings,
// including the Kochi samples, with the same rules as the PostGIS RPC.

const KOCHI = "/discover?lat=9.98160&lng=76.29990&near=Kochi";

test("location is only requested when the user presses Near me", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __geoAsked: number };
    w.__geoAsked = 0;
    navigator.geolocation.getCurrentPosition = (_ok, fail) => {
      w.__geoAsked += 1;
      fail?.({ code: 1, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3, message: "denied" } as GeolocationPositionError);
    };
  });
  await page.goto("/discover");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Where do you want to work?");
  await page.waitForLoadState("networkidle");
  expect(await page.evaluate(() => (window as unknown as { __geoAsked: number }).__geoAsked)).toBe(0);

  await page.getByRole("button", { name: "Use my current location" }).click();
  expect(await page.evaluate(() => (window as unknown as { __geoAsked: number }).__geoAsked)).toBe(1);
  await expect(page.getByText("Location access is blocked")).toBeVisible();
});

test("picking a suggested area shows nearby results with distances", async ({ page }) => {
  await page.goto("/discover");
  await page.getByRole("combobox").fill("kakk");
  await page.getByRole("option", { name: "Kakkanad, Kochi" }).click();
  await expect(page).toHaveURL(/lat=10\.01590/);
  const heading = page.locator("#results-heading");
  await expect(heading).toContainText(/\d+ spaces? within 5 km of Kakkanad, Kochi/);
  await expect(page.locator("article[data-space-id]").first()).toContainText(/\d(\.\d)? km|\d+ m/);
});

test("radius chips and filters change the result set", async ({ page }) => {
  await page.goto(`${KOCHI}&r=10`);
  const heading = page.locator("#results-heading");
  await expect(heading).toContainText(/within 10 km/);
  const wide = Number((await heading.innerText()).match(/\d+/)?.[0] ?? 0);
  expect(wide).toBeGreaterThan(3);

  await page.getByRole("button", { name: "1 km", exact: true }).click();
  await expect(heading).toContainText(/within 1 km/);
  const narrow = Number((await heading.innerText()).match(/\d+/)?.[0] ?? 0);
  expect(narrow).toBeLessThan(wide);

  await page.getByRole("button", { name: "10 km", exact: true }).click();
  await page.getByRole("button", { name: "Meeting rooms", exact: true }).click();
  await expect(page).toHaveURL(/cat=meeting_room/);
  for (const card of await page.locator("article[data-space-id]").all()) {
    await expect(card).toContainText("Meeting room");
  }
});

test("results are sorted nearest first by default", async ({ page }) => {
  await page.goto(`${KOCHI}&r=25`);
  await expect(page.locator("article[data-space-id]").first()).toBeVisible();
  const distances = await page.locator("article[data-space-id]").evaluateAll((cards) =>
    cards.map((c) => {
      const m = c.textContent?.match(/([\d.]+) (km|m) away/);
      if (!m) return Infinity;
      return m[2] === "km" ? Number(m[1]) * 1000 : Number(m[1]);
    })
  );
  expect(distances.length).toBeGreaterThan(1);
  for (let i = 1; i < distances.length; i++) expect(distances[i]).toBeGreaterThanOrEqual(distances[i - 1]);
});

test("discover has no serious accessibility violations", async ({ page }) => {
  await page.goto(`${KOCHI}&r=10`);
  await expect(page.locator("article[data-space-id]").first()).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    // The map canvas is a third-party widget; its markers are checked below.
    .exclude(".maplibregl-canvas-container")
    .analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
});

test("small screens switch between list and map", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(KOCHI);
  await expect(page.locator("#results-heading")).toBeVisible();
  await page.getByRole("button", { name: "Show map" }).click();
  await expect(page).toHaveURL(/view=map/);
  await expect(page.locator("#results-heading")).toBeHidden();
  await page.getByRole("button", { name: "Show list" }).click();
  await expect(page.locator("#results-heading")).toBeVisible();
});
