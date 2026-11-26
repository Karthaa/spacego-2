import { test, expect } from "@playwright/test";
import { KOCHI_DIRECTORY } from "../src/lib/data/directory";

// The Kochi directory lists real workspaces that are NOT on SpaceGo. It must
// never look bookable and its entries must stay out of search and the map.

const TOTAL = KOCHI_DIRECTORY.length;

test("directory page lists every entry and filters by area", async ({ page }) => {
  await page.goto("/directory/kochi");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Coworking spaces in Kochi");
  await expect(page.locator("#directory-results")).toHaveText(`${TOTAL} workspaces in Kochi`);
  await expect(page.locator("main article")).toHaveCount(TOTAL);
  await expect(page.locator("main article", { hasText: "Not on SpaceGo yet" })).toHaveCount(TOTAL);

  const kakkanad = KOCHI_DIRECTORY.filter((e) => e.area === "Kakkanad").length;
  await page.getByRole("button", { name: new RegExp(`^Kakkanad ${kakkanad}$`) }).click();
  await expect(page.locator("#directory-results")).toHaveText(`${kakkanad} workspaces in Kakkanad`);
  await expect(page.locator("main article")).toHaveCount(kakkanad);
});

test("directory cards have no booking, price or rating and open links safely", async ({ page }) => {
  await page.goto("/directory/kochi");
  const cards = page.locator("main article");
  await expect(cards.locator("img")).toHaveCount(0);
  await expect(cards.getByText(/book|₹|rating|reviews?/i)).toHaveCount(0);
  await expect(cards.locator('a[href^="/"]')).toHaveCount(0);

  const external = cards.locator("a");
  const n = await external.count();
  expect(n).toBe(TOTAL + KOCHI_DIRECTORY.filter((e) => e.website).length);
  for (let i = 0; i < n; i++) {
    await expect(external.nth(i)).toHaveAttribute("target", "_blank");
    await expect(external.nth(i)).toHaveAttribute("rel", "noopener noreferrer nofollow");
  }
});

test("home shows six directory entries with a link to the full list", async ({ page }) => {
  await page.goto("/");
  const section = page.locator("section", { has: page.locator("#kochi-directory-heading") });
  await expect(section.locator("article")).toHaveCount(6);
  await section.getByRole("link", { name: `See all ${TOTAL} in Kochi` }).click();
  await expect(page).toHaveURL(/\/directory\/kochi$/);
});

test("directory entries never appear in bookable search", async ({ page }) => {
  const names = KOCHI_DIRECTORY.map((e) => e.name);
  for (const path of ["/spaces", "/discover?lat=9.98160&lng=76.29990&near=Kochi"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const text = await page.locator("main").innerText();
    for (const name of names) expect(text, `${name} on ${path}`).not.toContain(name);
  }
});
