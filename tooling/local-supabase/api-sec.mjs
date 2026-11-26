// Security checks against the LOCAL backend (run after seed.mjs).
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
const STATE = process.env.STATE || "/tmp/spacego-local";
const URL = "http://127.0.0.1:54321", ANON = fs.readFileSync(`${STATE}/anon_key`, "utf8");
const creds = Object.fromEntries(fs.readFileSync(`${STATE}/creds`, "utf8").trim().split("\n").map((l) => l.split(":")));
const login = async (who) => { const c = createClient(URL, ANON, { auth: { persistSession: false } }); const r = await c.auth.signInWithPassword({ email: `${who}@spacego.test`, password: creds[who] }); return { c, id: r.data.user.id }; };
const owner = await login("owner"), seeker = await login("seeker");
const { data: rows } = await owner.c.from("spacego_spaces").select("id,data");
const pending = rows.find((r) => r.data.review.state === "changes_requested" || r.data.review.state === "pending");
const out = [];
let r = await owner.c.from("spacego_spaces").update({ data: { ...pending.data, status: "published" } }).eq("id", pending.id).select("id");
out.push(`owner publish unapproved via REST: ${r.error ? "BLOCKED " + r.error.code : "ALLOWED (bad)"}`);
r = await owner.c.from("spacego_spaces").update({ data: { ...pending.data, review: { state: "approved" } } }).eq("id", pending.id).select("id,data").single();
out.push(`owner forge review via REST: state now ${r.data?.data?.review?.state ?? r.error?.message}`);
r = await seeker.c.rpc("spacego_review_listing", { p_space_id: pending.id, p_decision: "approve" });
out.push(`seeker approve RPC: ${r.error ? "BLOCKED " + r.error.code : "ALLOWED (bad)"}`);
r = await seeker.c.from("spacego_listing_review_events").select("id");
out.push(`seeker reads audit: ${r.error ? "BLOCKED " + r.error.code : r.data.length + " rows"}`);
r = await owner.c.from("spacego_listing_review_events").select("id");
out.push(`owner reads audit: ${r.error ? "BLOCKED " + r.error.code : r.data.length + " rows"}`);
r = await seeker.c.rpc("spacego_submit_listing_for_review", { p_space_id: pending.id });
out.push(`seeker submit someone's listing: ${r.error ? "BLOCKED " + r.error.code : "ALLOWED (bad)"}`);
const anon = createClient(URL, ANON, { auth: { persistSession: false } });
r = await anon.rpc("spacego_public_space_point", { p_id: pending.id });
out.push(`anon point of unpublished listing: ${r.data?.length ?? r.error?.message} rows`);
r = await anon.rpc("spacego_search_spaces", { p_lat: 9.98, p_lng: 76.3, p_radius_m: 50000 });
out.push(`anon search leaks coordinates/owner_id: ${r.data.some((x) => x.data.owner_id || x.data.location.coordinates) ? "YES (bad)" : "no"}`);

// Address privacy (20261129): street address only for the owner, admins and confirmed guests.
r = await anon.from("spacego_public_spaces").select("id,data");
out.push(`anon view leaks a hidden street address: ${r.data.some((x) => x.data.location.address_visibility !== "exact" && (x.data.location.address || x.data.location.landmark)) ? "YES (bad)" : "no"}`);
r = await anon.rpc("spacego_space_address", { p_space_id: "local-test-2" });
out.push(`anon address RPC: ${r.error ? "BLOCKED " + r.error.code : "ALLOWED (bad)"}`);
{
  const start = new Date(Date.now() + (60 + Math.floor(Math.random() * 600)) * 86400000);
  start.setUTCHours(4, 30, 0, 0);
  const end = new Date(start.getTime() + 2 * 3600000);
  const bk = await seeker.c.rpc("spacego_create_booking", {
    p_space_id: "local-test-2", p_start_date: start.toISOString(), p_end_date: end.toISOString(),
    p_duration_type: "hourly", p_duration_units: 2, p_seats: 2,
  });
  if (bk.error) throw bk.error;
  r = await seeker.c.rpc("spacego_space_address", { p_space_id: "local-test-2" });
  out.push(`seeker address with a pending request: ${r.data?.length ?? r.error?.message} rows`);
  const ok = await owner.c.rpc("spacego_update_booking_status", { p_booking_id: bk.data.id, p_new_status: "approved" });
  if (ok.error) throw ok.error;
  r = await seeker.c.rpc("spacego_space_address", { p_space_id: "local-test-2" });
  out.push(`seeker address after the host confirms: ${r.data?.[0]?.address ? "shown" : "missing (bad)"}`);
  r = await seeker.c.rpc("spacego_space_address", { p_space_id: "local-test-3" });
  out.push(`seeker address of a space they did not book: ${r.data?.length ?? r.error?.message} rows`);
  // Leave nothing confirmed behind, so the check can run again.
  const cancel = await seeker.c.rpc("spacego_update_booking_status", { p_booking_id: bk.data.id, p_new_status: "cancelled" });
  if (cancel.error) throw cancel.error;
  r = await seeker.c.rpc("spacego_space_address", { p_space_id: "local-test-2" });
  out.push(`seeker address after cancelling: ${r.data?.length ?? r.error?.message} rows`);
}

// Verification checks (20261130): a badge needs recorded, dated checks, even for admins via the API.
{
  const admin = await login("admin");
  const { data: row } = await admin.c.from("spacego_spaces").select("id,data").eq("id", "local-test-2").single();
  const bare = { ...row.data, verification_level: "pro", passport: { ...row.data.passport, identity_verified: false, property_authority_verified: false, permitted_use_confirmed: false, power_backup_tested: false, fire_safety_inspected: false, connectivity_tested_mbps: 0 } };
  r = await admin.c.from("spacego_spaces").update({ data: bare }).eq("id", "local-test-2").select("id");
  out.push(`admin badge without checks via REST: ${r.error ? "BLOCKED " + r.error.code : "ALLOWED (bad)"}`);
  r = await owner.c.from("spacego_spaces").update({ data: { ...row.data, verification_level: "pro", passport: { ...row.data.passport, identity_verified: true, inspected_at: "2026-11-26" } } }).eq("id", "local-test-2").select("id,data").single();
  out.push(`owner self-awarded badge via REST: level now ${r.data?.data?.verification_level ?? r.error?.code}`);
}

// Reviews (20261201): only through the RPC, only after a confirmed stay has ended.
r = await seeker.c.from("spacego_space_reviews").insert({ booking_id: "x", space_id: "local-test-1", author_id: seeker.id, rating: 5, body: "Direct insert that should not work." }).select("id");
out.push(`seeker inserts a review directly: ${r.error ? "BLOCKED " + r.error.code : "ALLOWED (bad)"}`);
{
  const start = new Date(Date.now() + (60 + Math.floor(Math.random() * 600)) * 86400000);
  start.setUTCHours(4, 30, 0, 0);
  const bk = await seeker.c.rpc("spacego_create_booking", {
    p_space_id: "local-test-1", p_start_date: start.toISOString(), p_end_date: new Date(start.getTime() + 2 * 3600000).toISOString(),
    p_duration_type: "hourly", p_duration_units: 2, p_seats: 1,
  });
  if (bk.error) throw bk.error;
  r = await seeker.c.rpc("spacego_submit_review", { p_booking_id: bk.data.id, p_rating: 5, p_body: "Reviewing before the visit has happened." });
  out.push(`seeker reviews a booking that hasn't ended: ${r.error ? "BLOCKED " + r.error.code : "ALLOWED (bad)"}`);
  r = await owner.c.rpc("spacego_submit_review", { p_booking_id: bk.data.id, p_rating: 5, p_body: "Host reviewing their own space here." });
  out.push(`host reviews their own space via a guest's booking: ${r.error ? "BLOCKED " + r.error.code : "ALLOWED (bad)"}`);
  await seeker.c.rpc("spacego_update_booking_status", { p_booking_id: bk.data.id, p_new_status: "cancelled" });
}
r = await anon.from("spacego_space_reviews").select("id");
out.push(`anon reads the reviews table: ${r.error ? "BLOCKED " + r.error.code : r.data.length + " rows (bad)"}`);

// Booking integrity (20261202): no duplicate overlapping requests; history recorded.
{
  const start = new Date(Date.now() + (60 + Math.floor(Math.random() * 600)) * 86400000);
  start.setUTCHours(4, 30, 0, 0);
  const args = {
    p_space_id: "local-test-2", p_start_date: start.toISOString(), p_end_date: new Date(start.getTime() + 2 * 3600000).toISOString(),
    p_duration_type: "hourly", p_duration_units: 2, p_seats: 1,
  };
  const first = await seeker.c.rpc("spacego_create_booking", args);
  if (first.error) throw first.error;
  r = await seeker.c.rpc("spacego_create_booking", args);
  out.push(`seeker sends the same request twice: ${r.error ? "BLOCKED " + r.error.code : "ALLOWED (bad)"}`);
  await seeker.c.rpc("spacego_update_booking_status", { p_booking_id: first.data.id, p_new_status: "cancelled" });
  r = await seeker.c.from("spacego_booking_events").select("from_status,to_status").eq("booking_id", first.data.id).order("id");
  out.push(`booking history: ${r.error ? r.error.message : r.data.map((e) => `${e.from_status ?? "new"}->${e.to_status}`).join(", ")}`);
  const other = await createClient(URL, ANON, { auth: { persistSession: false } }).from("spacego_booking_events").select("id").eq("booking_id", first.data.id);
  out.push(`anon reads booking history: ${other.error ? "BLOCKED " + other.error.code : other.data.length + " rows"}`);
}

// Reports (20261203)
r = await anon.rpc("spacego_report_listing", { p_space_id: "local-test-1", p_reason: "scam", p_details: "" });
out.push(`anon reports a listing: ${r.error ? "BLOCKED " + r.error.code : "ALLOWED (bad)"}`);
r = await owner.c.from("spacego_listing_reports").select("id,reporter_id");
out.push(`host reads reports about them: ${r.error ? "BLOCKED " + r.error.code : r.data.length + " rows"}`);
r = await seeker.c.rpc("spacego_resolve_report", { p_report_id: "00000000-0000-4000-8000-000000000000", p_status: "dismissed", p_note: "Not an admin" });
out.push(`seeker resolves a report: ${r.error ? "BLOCKED " + r.error.code : "ALLOWED (bad)"}`);
console.log(out.join("\n"));
