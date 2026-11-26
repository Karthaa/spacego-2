// Seed the LOCAL backend with test listings through the real API (owner insert,
// submit for review, admin decision). Never point this at staging or production.
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import fs from "node:fs";
const STATE = process.env.STATE || "/tmp/spacego-local";
const URL = "http://127.0.0.1:54321";
const ANON = fs.readFileSync(`${STATE}/anon_key`, "utf8");
// Test accounts: owner, admin, seeker @spacego.test, random passwords kept in $STATE/creds.
if (!fs.existsSync(`${STATE}/creds`)) {
  const lines = [];
  for (const who of ["owner", "admin", "seeker"]) {
    const pw = crypto.randomBytes(15).toString("base64url");
    const c = createClient(URL, ANON, { auth: { persistSession: false } });
    const { error } = await c.auth.signUp({ email: `${who}@spacego.test`, password: pw, options: { data: { role: who === "seeker" ? "seeker" : "owner", full_name: `Test ${who}` } } });
    if (error) throw error;
    lines.push(`${who}:${pw}`);
  }
  fs.writeFileSync(`${STATE}/creds`, lines.join("\n") + "\n", { mode: 0o600 });
  console.log("Created test accounts. Make the admin one an admin with:");
  console.log("  update public.profiles set role = 'admin' where email = 'admin@spacego.test';");
  console.log("then run this script again.");
  process.exit(0);
}
const creds = Object.fromEntries(fs.readFileSync(`${STATE}/creds`, "utf8").trim().split("\n").map((l) => l.split(":")));
const login = async (who) => {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email: `${who}@spacego.test`, password: creds[who] });
  if (error) throw error;
  return { c, id: data.user.id };
};
const owner = await login("owner");
const admin = await login("admin");
const seeds = [
  ["Infopark Focus Desks", "coworking", "Kakkanad", 10.0093, 76.3612, 40, { hourly: 120, daily: 450, monthly: 6500 }, ["High-speed Wi-Fi", "Power backup", "Air conditioning", "Parking"], true],
  ["Edappally Boardroom", "meeting_room", "Edappally", 10.0258, 76.3084, 12, { hourly: 650, daily: 4200 }, ["High-speed Wi-Fi", "Display screen", "Air conditioning"], false],
  ["MG Road Private Office", "private_office", "MG Road", 9.9719, 76.2853, 8, { daily: 2400, monthly: 38000 }, ["High-speed Wi-Fi", "Power backup", "Reception"], false],
  ["Vyttila Hub Coworking", "coworking", "Vyttila", 9.9676, 76.3206, 30, { hourly: 110, daily: 420 }, ["High-speed Wi-Fi", "Parking", "Printer"], true],
];
let n = 0;
for (const [title, category, area, lat, lng, capacity, pricing, amenities, instant] of seeds) {
  n++;
  const id = `local-test-${n}`;
  const data = {
    id, title: `${title} (local test)`, slug: id, category, headline: `Local test listing in ${area}`,
    description: "Local end-to-end test listing. Not a real workspace.",
    location: { city: "Kochi", address: `Test address, ${area}`, country: "India", landmark: area, coordinates: { lat, lng } },
    capacity, square_feet: 1000, pricing: { ...pricing, currency: "INR" }, amenities,
    operating_hours: { open: "09:00", close: "19:00", days: ["Mon", "Tue", "Wed", "Thu", "Fri"] }, house_rules: [],
    images: [{ url: "https://images.unsplash.com/photo-1497366216548-37526070297c", caption: "Main room", is_cover: true }],
    owner_id: owner.id, status: "published", instant_book: instant,
  };
  const ins = await owner.c.from("spacego_spaces").insert({ id, data }).select("id,data").single();
  if (ins.error) throw ins.error;
  console.log(id, "inserted as", ins.data.data.status, "/", ins.data.data.review.state);
  if (n === 4) { console.log(id, "left as draft for the UI test"); continue; }
  const sub = await owner.c.rpc("spacego_submit_listing_for_review", { p_space_id: id });
  if (sub.error) throw sub.error;
  if (n === 3) { console.log(id, "left pending for the admin queue test"); continue; }
  const ap = await admin.c.rpc("spacego_review_listing", { p_space_id: id, p_decision: "approve" });
  if (ap.error) throw ap.error;
  console.log(id, "approved ->", ap.data.status);
}
const anon = createClient(URL, ANON, { auth: { persistSession: false } });
const s = await anon.rpc("spacego_search_spaces", { p_lat: 9.9816, p_lng: 76.2999, p_radius_m: 10000 });
console.log("anon search:", s.error ?? s.data.map((r) => `${r.id} ${r.distance_m}m`));
const v = await anon.from("spacego_spaces").select("id").limit(1);
console.log("anon base table:", v.error ? v.error.code + " " + v.error.message : v.data);
