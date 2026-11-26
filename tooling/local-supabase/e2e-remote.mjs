// End-to-end checks against the LOCAL backend: run seed.mjs first (fresh data),
// start the app with the local env, then: BASE_URL=http://localhost:3000 node tooling/local-supabase/e2e-remote.mjs
import { chromium } from "playwright";
import fs from "node:fs";
const STATE = process.env.STATE || "/tmp/spacego-local";
const SHOTS = process.env.SHOTS || STATE;
const base = process.env.BASE_URL || "http://localhost:3000";
const creds = Object.fromEntries(fs.readFileSync(`${STATE}/creds`, "utf8").trim().split("\n").map((l) => l.split(":")));
const browser = await chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}), args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
const results = [];
if (!fs.existsSync(`${STATE}/test.png`)) {
  // 1x1 PNG is enough for the upload path; the browser resizes it.
  fs.writeFileSync(`${STATE}/test.png`, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64"));
}
const check = (name, ok, extra = "") => { results.push(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " :: " + extra : ""}`); };
const newPage = async (w = 1440) => {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => results.push("PAGEERROR " + String(e).slice(0, 200)));
  return { ctx, page };
};
const login = async (page, who) => {
  await page.goto(base + "/auth/login");
  await page.getByLabel("Email").fill(`${who}@spacego.test`);
  await page.getByLabel("Password").fill(creds[who]);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/auth/login"), { timeout: 15000 });
};
const shot = (page, name) => page.screenshot({ path: `${SHOTS}/remote-${name}.png`, fullPage: false });

// 1. Anonymous discover against the real API
{
  const { ctx, page } = await newPage();
  await page.goto(base + "/discover?lat=9.98160&lng=76.29990&near=Kochi&r=10", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const heading = (await page.locator("#results-heading").innerText()).replace(/\s+/g, " ");
  check("anon discover shows 2 approved listings", /^2 spaces/.test(heading), heading);
  check("no demo banner in remote mode", (await page.getByText("Sample data.").count()) === 0);
  check("map markers rendered", (await page.locator(".sg-price-marker, .sg-cluster-marker").count()) > 0);
  await shot(page, "discover");
  await page.goto(base + "/spaces/local-test-1", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  check("detail page area map (RPC point)", (await page.locator("#location-heading").count()) === 1);
  await page.goto(base + "/spaces/local-test-3", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  check("pending listing is not public", (await page.getByText("This space isn't available").count()) === 1);
  await ctx.close();
}

// 2. Owner: statuses, submit draft, create new listing
{
  const { ctx, page } = await newPage();
  await login(page, "owner");
  await page.goto(base + "/owner/properties", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const body = await page.locator("main").innerText();
  check("owner sees Live / In review / Draft badges", /Live/.test(body) && /In review/.test(body) && /Draft/.test(body));
  check("no Publish button on unapproved listings", (await page.getByRole("button", { name: "Publish", exact: true }).count()) === 0);
  await shot(page, "owner-properties");
  await page.getByRole("button", { name: "Submit for review" }).first().click();
  await page.waitForTimeout(1500);
  check("draft submitted -> no Submit buttons left", (await page.getByRole("button", { name: "Submit for review" }).count()) === 0);

  await page.goto(base + "/owner/spaces/new", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.getByRole("textbox", { name: "Title", exact: true }).fill("Kaloor Quiet Room (local test)");
  await page.getByRole("textbox", { name: "Street address", exact: true }).fill("Test address, Kaloor");
  await page.getByRole("textbox", { name: "City", exact: true }).fill("Kochi");
  await page.getByLabel(/Per day/).fill("900");
  // Try submitting without a pin or photos first.
  await page.getByRole("button", { name: "Submit for review" }).click();
  await page.waitForTimeout(500);
  check("pin required message", (await page.getByText("Place the pin on your building").count()) > 0);
  check("photo required message", (await page.getByText("Add at least one photo of the space.").count()) > 0);
  await page.locator('input[type="file"]').setInputFiles(`${STATE}/test.png`);
  await page.waitForSelector('img[alt="Photo 1"]', { timeout: 15000 });
  const src = await page.locator('img[alt="Photo 1"]').getAttribute("src");
  check("photo uploaded to storage", /\/storage\/v1\/object\/public\/listing-photos\//.test(src ?? ""), (src ?? "").replace(/[0-9a-f-]{36}/, "<uid>"));
  const canvas = page.locator('[aria-label^="Map. Click to place the pin"] canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(400);
  check("pin set message", (await page.getByText("Pin set.").count()) === 1);
  await shot(page, "owner-new-pin");
  await page.getByRole("button", { name: "Submit for review" }).click();
  await page.waitForURL(/\/owner\/properties/, { timeout: 15000 });
  await page.waitForTimeout(1500);
  check("new listing appears In review", (await page.locator("main").innerText()).includes("Kaloor Quiet Room (local test)"));
  await shot(page, "owner-after-create");
  await ctx.close();
}

// 3. Admin: queue, request changes, approve
{
  const { ctx, page } = await newPage();
  await login(page, "admin");
  await page.goto(base + "/admin/spaces", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const q = (await page.locator("#queue-heading").innerText()).replace(/\s+/g, " ");
  check("admin queue shows 3 pending", /\(3\)/.test(q), q);
  await shot(page, "admin-queue");
  const items = page.locator('section[aria-labelledby="queue-heading"] li');
  // request changes on the first
  await items.first().getByRole("button", { name: "Request changes" }).click();
  await page.getByLabel("Reason for the host").fill("Please add a photo that shows the room itself.");
  await shot(page, "admin-reason");
  await page.getByRole("button", { name: "Send request" }).click();
  await page.waitForTimeout(1500);
  // approve the Kaloor one
  const kaloor = items.filter({ hasText: "Kaloor Quiet Room" });
  await kaloor.getByRole("button", { name: "Approve" }).click();
  await page.waitForTimeout(1500);
  const q2 = (await page.locator("#queue-heading").innerText()).replace(/\s+/g, " ");
  check("queue down to 1 after two decisions", /\(1\)/.test(q2), q2);
  await ctx.close();
}

// 4. Owner sees reason; anon sees the newly approved listing
{
  const { ctx, page } = await newPage(390);
  await login(page, "owner");
  await page.goto(base + "/owner/properties", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  check("owner sees requested-changes reason", (await page.getByText("Please add a photo that shows the room itself.").count()) === 1);
  check("Resubmit offered", (await page.getByRole("button", { name: "Resubmit" }).count()) === 1);
  await shot(page, "owner-reason-390");
  await ctx.close();
  const a = await newPage();
  await a.page.goto(base + "/discover?lat=9.99750&lng=76.29200&near=Kaloor&r=3", { waitUntil: "networkidle" });
  await a.page.waitForTimeout(1500);
  check("approved new listing is discoverable", (await a.page.locator("main").innerText()).includes("Kaloor Quiet Room"));
  await a.ctx.close();
}
console.log(results.join("\n"));
if (results.some((r) => !r.startsWith("PASS"))) process.exitCode = 1;
await browser.close();
