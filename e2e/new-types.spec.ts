import { test, expect } from "@playwright/test";

// Demo mode (no Supabase env). demo-kochi-9 (parking) and demo-kochi-10
// (auditorium) are local demo listings based on real Kochi places (is_demo).

test("home shows tiles for every type, including Parking and Auditoriums", async ({ page }) => {
  await page.goto("/");
  const browse = page.locator("section", { has: page.locator("#browse-heading") });
  await expect(browse.getByRole("link")).toHaveCount(1 + 8); // "All spaces" + 8 types
  // Photo URLs are checked by id rather than by loading them, so the test
  // doesn't depend on Unsplash being reachable.
  const tiles = [
    ["Auditoriums", "auditorium", "photo-1540575467063-178a50c2df87"],
    ["Parking", "parking", "photo-1506521781263-d8422e82f27a"],
  ] as const;
  for (const [label, id, photo] of tiles) {
    const tile = browse.getByRole("link", { name: new RegExp(`^${label}`) });
    await expect(tile).toHaveAttribute("href", `/spaces?category=${id}`);
    await expect(tile.locator("img")).toHaveAttribute("src", new RegExp(photo));
  }
});

test("parking filter on /spaces shows the demo parking listing with a Demo pill", async ({ page }) => {
  await page.goto("/spaces");
  await page.getByRole("button", { name: "Parking", exact: true }).click();
  const card = page.locator("article", { hasText: "Vyttila Mobility Hub parking" });
  await expect(card).toBeVisible();
  await expect(card.getByText("Demo", { exact: true })).toBeVisible();
  await expect(card.getByText("Parking", { exact: true })).toBeVisible();
  await expect(page.locator("article", { hasText: "Ernakulam Town Hall" })).toHaveCount(0);
});

test("auditorium filter works on /discover", async ({ page }) => {
  await page.goto("/discover?lat=9.98160&lng=76.29990&near=Kochi&cat=auditorium");
  await page.waitForLoadState("networkidle");
  const card = page.locator("article", { hasText: "Ernakulam Town Hall" });
  await expect(card).toBeVisible();
  await expect(card.getByText("Demo", { exact: true })).toBeVisible();
  await expect(page.locator("article", { hasText: "Vyttila Mobility Hub parking" })).toHaveCount(0);
});

test("demo listing page shows the demo note and no verification, rating or reviews", async ({ page }) => {
  await page.goto("/spaces/demo-kochi-10");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ernakulam Town Hall");
  await expect(page.getByRole("note").filter({ hasText: "Demo listing based on a real Kochi place" })).toContainText(
    "The venue hasn't joined SpaceGo, so the photos, prices and details are samples."
  );
  await expect(page.getByText("800 seats")).toBeVisible();
  await expect(page.getByText("Demo booking: nothing is sent to the venue.")).toBeVisible();
  const main = page.locator("main");
  await expect(main.getByText(/Reviewed by SpaceGo|SpaceGo Ready|SpaceGo Pro|New listing/)).toHaveCount(0);
  await expect(main.getByRole("heading", { name: /What SpaceGo checked|Reviews/i })).toHaveCount(0);
});

test("parking capacity reads as vehicles", async ({ page }) => {
  await page.goto("/spaces/demo-kochi-9");
  await expect(page.getByText("Up to 120 vehicles")).toBeVisible();
  await expect(page.getByLabel("Vehicles")).toBeVisible();
});

test("a regular listing is not marked as a demo", async ({ page }) => {
  await page.goto("/spaces/space-1");
  await expect(page.getByText(/Demo listing based on a real Kochi place/)).toHaveCount(0);
  await expect(page.getByText("Demo booking: nothing is sent to the venue.")).toHaveCount(0);
});

test("footer links to the new types, and the local build has no test-site banner", async ({ page }) => {
  await page.goto("/");
  const footer = page.locator("footer");
  await expect(footer.getByRole("link", { name: "Auditoriums" })).toHaveAttribute("href", "/spaces?category=auditorium");
  await expect(footer.getByRole("link", { name: "Parking" })).toHaveAttribute("href", "/spaces?category=parking");
  await expect(page.getByText("Demo site with sample listings")).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
});

// Prices match the database rule (spacego_create_booking): halls and event
// venues are hired whole; parking is per vehicle; desks are per person.
function totalRow(page: import("@playwright/test").Page) {
  return page.locator("dl div", { hasText: "Estimated total" }).locator("dd");
}

test("a hall is priced for the whole venue, whatever the guest count", async ({ page }) => {
  await page.goto("/spaces/demo-kochi-10"); // Ernakulam Town Hall: 25,000 a day
  await expect(page.getByText("/ day, whole venue").first()).toBeVisible();
  await page.getByRole("spinbutton", { name: "Guests" }).fill("200");
  await expect(page.getByText(/× 1 day, whole venue/)).toBeVisible();
  await expect(totalRow(page)).toHaveText("₹27,500"); // 25,000 + 10% fee, not x 200
});

test("parking is priced per vehicle", async ({ page }) => {
  await page.goto("/spaces/demo-kochi-9"); // Vyttila Mobility Hub parking: 20 an hour
  await page.getByLabel("Booking length").selectOption("hourly");
  await page.getByRole("spinbutton", { name: "Hours" }).fill("3");
  await page.getByRole("spinbutton", { name: "Vehicles" }).fill("2");
  await expect(page.getByText(/× 3 hours × 2 vehicles/)).toBeVisible();
  await expect(totalRow(page)).toHaveText("₹132"); // 20 x 3 x 2 = 120, + 12 fee
});
