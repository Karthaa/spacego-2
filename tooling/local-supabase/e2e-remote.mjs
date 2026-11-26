// End-to-end checks against the LOCAL backend: run seed.mjs first (fresh data),
// start the app with the local env, then: BASE_URL=http://localhost:3000 node tooling/local-supabase/e2e-remote.mjs
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
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
  await page.locator('input[type="file"][multiple]').setInputFiles(`${STATE}/test.png`);
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

// 5. Address privacy: area only in public; the address after the host confirms.
{
  const { ctx, page } = await newPage();
  await page.goto(base + "/spaces/local-test-1", { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const body = await page.locator("main").innerText();
  check("public listing hides the street address", !body.includes("Test address, Kakkanad"));
  check("public listing explains when the address is shared",
    (await page.getByText("The host shares the exact address once your booking is confirmed.").count()) === 1);
  await ctx.close();

  // Instant-book space: the API confirms the booking straight away.
  const ANON = fs.readFileSync(`${STATE}/anon_key`, "utf8");
  const api = createClient("http://127.0.0.1:54321", ANON, { auth: { persistSession: false } });
  await api.auth.signInWithPassword({ email: "seeker@spacego.test", password: creds.seeker });
  const start = new Date(Date.now() + (60 + Math.floor(Math.random() * 600)) * 86400000);
  start.setUTCHours(4, 30, 0, 0);
  const bk = await api.rpc("spacego_create_booking", {
    p_space_id: "local-test-1", p_start_date: start.toISOString(),
    p_end_date: new Date(start.getTime() + 2 * 3600000).toISOString(),
    p_duration_type: "hourly", p_duration_units: 2, p_seats: 1,
  });
  check("instant booking confirmed by the API", bk.data?.status === "approved", bk.error?.message ?? bk.data?.status);

  const s = await newPage();
  await login(s.page, "seeker");
  await s.page.goto(base + "/dashboard/bookings", { waitUntil: "networkidle" });
  await s.page.waitForTimeout(1500);
  const row = s.page.locator("tr", { hasText: bk.data?.id ?? "none" });
  await row.getByRole("button", { name: "Address" }).click();
  await s.page.getByText("Test address, Kakkanad").waitFor({ timeout: 8000 }).catch(() => {});
  check("confirmed guest sees the street address", (await s.page.getByText("Test address, Kakkanad").count()) === 1);
  check("open-in-map link uses the exact pin",
    /mlat=10\.009300&mlon=76\.361200/.test((await s.page.getByRole("link", { name: "Open in map" }).getAttribute("href")) ?? ""));
  await shot(s.page, "booking-address");
  await s.ctx.close();
  if (bk.data?.id) await api.rpc("spacego_update_booking_status", { p_booking_id: bk.data.id, p_new_status: "cancelled" });
}

// 6. Admin records what SpaceGo checked; guests see exactly that.
{
  const { ctx, page } = await newPage();
  await login(page, "admin");
  await page.goto(base + "/admin/spaces", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "Record checks for Infopark Focus Desks (local test)" }).click();
  const dialog = page.getByRole("dialog");
  check("badge locked until a check is recorded", await dialog.getByLabel("Badge").isDisabled());
  await dialog.getByLabel("Host identity checked").check();
  await dialog.getByLabel("Internet speed measured (Mbps)").fill("150");
  await dialog.getByLabel("Badge").selectOption("checked");
  await dialog.getByRole("button", { name: "Save checks" }).click();
  check("save refused until the admin confirms", (await dialog.getByText("Confirm that these checks actually happened.").count()) === 1);
  await dialog.getByLabel(/I confirm these 2 checks actually happened/).check();
  await shot(page, "admin-checks");
  await dialog.getByRole("button", { name: "Save checks" }).click();
  await page.getByText("Checks saved").waitFor({ timeout: 8000 }).catch(() => {});
  check("checks saved", (await page.getByText("2 checks recorded. Badge: Reviewed by SpaceGo.").count()) === 1);
  await ctx.close();

  const a = await newPage();
  await a.page.goto(base + "/spaces/local-test-1", { waitUntil: "networkidle" });
  await a.page.waitForTimeout(1000);
  const main = await a.page.locator("main").innerText();
  check("guest sees the recorded checks", main.includes("What SpaceGo checked") && main.includes("Host identity checked") && main.includes("Internet speed measured at 150 Mbps"));
  check("guest sees the badge", main.includes("Reviewed by SpaceGo"));
  check("no unrecorded checks shown", !main.includes("Fire safety equipment checked") && !main.includes("right to list"));
  await a.ctx.close();
}

// 7. Reviews: only after a confirmed stay has ended; host responds; admin hides.
{
  // Fixture: a stay that has already ended. The booking RPC refuses past
  // dates, so this row is written directly into the LOCAL database.
  const sql = `
    INSERT INTO public.spacego_bookings (id, data)
    SELECT 'local-past-1', jsonb_build_object(
      'id', 'local-past-1', 'space_id', 'local-test-1', 'space_title', 'Infopark Focus Desks (local test)',
      'space_image', '', 'space_location', 'Kochi, India', 'space_category', 'coworking',
      'user_id', seeker.id::text, 'user_name', 'Test seeker', 'user_email', 'seeker@spacego.test',
      'owner_id', s.data ->> 'owner_id', 'status', 'approved',
      'start_date', to_jsonb(now() - interval '3 days'), 'end_date', to_jsonb(now() - interval '3 days' + interval '2 hours'),
      'duration_type', 'hourly', 'duration_units', 2, 'seats', 1, 'total_price', 264, 'currency', 'INR',
      'created_at', to_jsonb(now() - interval '10 days'))
    FROM public.profiles seeker, public.spacego_spaces s
    WHERE seeker.email = 'seeker@spacego.test' AND s.id = 'local-test-1'
    ON CONFLICT (id) DO NOTHING;`;
  execFileSync("psql", ["-v", "ON_ERROR_STOP=1", "-q", "-d", process.env.DB || "spacego_local", "-c", sql], { stdio: "inherit" });

  const g = await newPage();
  await login(g.page, "seeker");
  await g.page.goto(base + "/dashboard/bookings", { waitUntil: "networkidle" });
  await g.page.waitForTimeout(1500);
  const row = g.page.locator("tr", { hasText: "local-past-1" });
  await row.getByRole("button", { name: "Write a review" }).click();
  const dlg = g.page.getByRole("dialog");
  await dlg.getByRole("button", { name: "Post review" }).click();
  check("review needs a rating", (await dlg.getByText("Choose a rating.").count()) === 1);
  await dlg.getByRole("radio", { name: "4 stars" }).check({ force: true });
  await dlg.getByLabel("Your review").fill("Quiet desks, fast Wi-Fi and the host helped with parking.");
  await shot(g.page, "write-review");
  await dlg.getByRole("button", { name: "Post review" }).click();
  await g.page.getByText("You rated it 4 of 5").first().waitFor({ timeout: 8000 }).catch(() => {});
  check("guest's booking shows their rating", (await row.getByText("You rated it 4 of 5").count()) === 1);
  await g.ctx.close();

  const a = await newPage();
  await a.page.goto(base + "/spaces/local-test-1", { waitUntil: "networkidle" });
  await a.page.waitForTimeout(1200);
  const reviews = a.page.locator("section[aria-labelledby=guest-reviews-heading]");
  const text = (await reviews.innerText()).replace(/\s+/g, " ");
  check("public listing shows the real review and average", /4\.0\s*·\s*1 review/.test(text) && text.includes("Quiet desks, fast Wi-Fi") && text.includes("Test"), text.slice(0, 160));
  await a.ctx.close();

  const o = await newPage();
  await login(o.page, "owner");
  await o.page.goto(base + "/spaces/local-test-1", { waitUntil: "networkidle" });
  await o.page.waitForTimeout(1200);
  await o.page.getByRole("button", { name: "Respond" }).click();
  await o.page.getByLabel("Your public response").fill("Thanks! Parking is free after 6 pm too.");
  await o.page.getByRole("button", { name: "Post response" }).click();
  await o.page.getByText("Response from the host").waitFor({ timeout: 8000 }).catch(() => {});
  check("host response shown", (await o.page.getByText("Thanks! Parking is free after 6 pm too.").count()) === 1);
  await shot(o.page, "review-response");
  await o.ctx.close();

  const ad = await newPage();
  await login(ad.page, "admin");
  await ad.page.goto(base + "/spaces/local-test-1", { waitUntil: "networkidle" });
  await ad.page.waitForTimeout(1200);
  await ad.page.getByRole("button", { name: "Hide review" }).click();
  await ad.page.getByLabel(/Why are you hiding this review/).fill("Test of moderation: hiding this review.");
  await ad.page.locator("section[aria-labelledby=guest-reviews-heading] form").getByRole("button", { name: "Hide review" }).click();
  await ad.page.getByText("No reviews yet.").waitFor({ timeout: 8000 }).catch(() => {});
  check("admin hides the review", (await ad.page.getByText("No reviews yet.").count()) === 1);
  await ad.ctx.close();

  const g2 = await newPage();
  await login(g2.page, "seeker");
  await g2.page.goto(base + "/dashboard/bookings", { waitUntil: "networkidle" });
  await g2.page.waitForTimeout(1500);
  check("guest sees their review was hidden", (await g2.page.locator("tr", { hasText: "local-past-1" }).getByText("Review hidden by SpaceGo").count()) === 1);
  await g2.ctx.close();
}

// 8. Reports: guests report a listing; admins resolve it.
{
  const a = await newPage();
  await a.page.goto(base + "/spaces/local-test-2", { waitUntil: "networkidle" });
  await a.page.getByRole("button", { name: "Report this listing" }).click();
  await a.page.waitForURL(/\/auth\/login/, { timeout: 8000 }).catch(() => {});
  check("signed-out report goes to sign in", a.page.url().includes("/auth/login"));
  await a.ctx.close();

  const g = await newPage(390);
  await login(g.page, "seeker");
  await g.page.goto(base + "/spaces/local-test-2", { waitUntil: "networkidle" });
  await g.page.waitForTimeout(800);
  await g.page.getByRole("button", { name: "Report this listing" }).click();
  const dlg = g.page.getByRole("dialog");
  await dlg.getByLabel("Photos, price or details are wrong").check();
  await dlg.getByLabel("Details (optional)").fill("The photos show a different building.");
  await shot(g.page, "report-390");
  await dlg.getByRole("button", { name: "Send report" }).click();
  await g.page.getByText("Report sent").waitFor({ timeout: 8000 }).catch(() => {});
  check("guest report sent", (await g.page.getByText("Report sent").count()) === 1);
  await g.page.getByRole("button", { name: "Report this listing" }).click();
  await dlg.getByLabel("It's unsafe").check();
  await dlg.getByRole("button", { name: "Send report" }).click();
  await g.page.getByText("You have already reported this listing").waitFor({ timeout: 8000 }).catch(() => {});
  check("second open report refused", (await g.page.getByText("You have already reported this listing").count()) === 1);
  await g.ctx.close();

  const o = await newPage();
  await login(o.page, "owner");
  await o.page.goto(base + "/spaces/local-test-2", { waitUntil: "networkidle" });
  await o.page.waitForTimeout(800);
  check("host can't report their own listing", (await o.page.getByRole("button", { name: "Report this listing" }).count()) === 0);
  await o.ctx.close();

  const ad = await newPage();
  await login(ad.page, "admin");
  await ad.page.goto(base + "/admin/spaces", { waitUntil: "networkidle" });
  await ad.page.waitForTimeout(1200);
  const heading = async () => (await ad.page.locator("#reports-heading").innerText()).replace(/\s+/g, " ");
  check("admin sees the report", (await heading()) === "Reported listings (1)" && (await ad.page.getByText("The photos show a different building.").count()) === 1, await heading());
  await shot(ad.page, "admin-reports");
  await ad.page.locator("section[aria-labelledby=reports-heading]").getByRole("button", { name: "Resolve" }).click();
  await ad.page.getByLabel("What did you do?").fill("Asked the host to replace the photos.");
  await ad.page.getByRole("button", { name: "Resolve report" }).click();
  await ad.page.getByText("Report resolved").waitFor({ timeout: 8000 }).catch(() => {});
  await ad.page.waitForTimeout(800);
  check("report resolved and cleared", (await heading()) === "Reported listings (0)", await heading());
  await ad.ctx.close();
}

// 9. Private documents: host uploads; only admins (and the host) can open them.
{
  if (!fs.existsSync(`${STATE}/lease.pdf`)) {
    fs.writeFileSync(`${STATE}/lease.pdf`, "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");
  }
  const o = await newPage();
  await login(o.page, "owner");
  await o.page.goto(base + "/owner/spaces/local-test-4/edit", { waitUntil: "networkidle" });
  await o.page.waitForTimeout(1000);
  await o.page.getByLabel("Type of document").selectOption("authority");
  await o.page.locator('input[type="file"][accept^="application/pdf"]').setInputFiles(`${STATE}/lease.pdf`);
  await o.page.getByText("lease.pdf uploaded").waitFor({ timeout: 10000 }).catch(() => {});
  check("host uploads a private document", (await o.page.getByText("lease.pdf uploaded. Only you and the SpaceGo team can open it.").count()) === 1);
  await shot(o.page, "owner-documents");
  await o.page.getByRole("button", { name: "Save changes" }).click();
  await o.page.waitForURL((u) => !u.pathname.endsWith("/edit"), { timeout: 10000 }).catch(() => {});
  await o.ctx.close();

  const { ctx, page } = await newPage();
  await login(page, "admin");
  await page.goto(base + "/admin/spaces", { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const card = page.locator('section[aria-labelledby="queue-heading"] li', { hasText: "Vyttila Hub Coworking" });
  check("admin sees the document on the queued listing", (await card.getByText("Lease or letter of permission").count()) === 1);
  const [popup] = await Promise.all([
    page.waitForEvent("popup", { timeout: 10000 }),
    card.getByRole("button", { name: "Open lease.pdf" }).click(),
  ]);
  await popup.waitForURL(/\/storage\/v1\/object\/sign\/listing-documents\//, { timeout: 10000 }).catch(() => {});
  const signed = popup.url();
  check("admin opens it through a signed link", /\/storage\/v1\/object\/sign\/listing-documents\/.+token=/.test(signed), signed.replace(/token=[^&]+/, "token=<redacted>").replace(/[0-9a-f-]{36}/, "<uid>"));
  const res = await fetch(signed.replace("localhost", "127.0.0.1"));
  check("signed link serves the file", res.status === 200, String(res.status));
  const unsigned = signed.replace("/object/sign/", "/object/public/").replace(/\?.*$/, "");
  const pub = await fetch(unsigned.replace("localhost", "127.0.0.1"));
  check("no public URL for documents", pub.status !== 200, String(pub.status));
  await ctx.close();
}
console.log(results.join("\n"));
if (results.some((r) => !r.startsWith("PASS"))) process.exitCode = 1;
await browser.close();
