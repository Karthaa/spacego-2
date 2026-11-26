// Unit tests for the redirect origin (src/lib/auth/origin.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { requestOrigin } from "../../src/lib/auth/origin.ts";

const SITE = "https://spacego.example";

function request(headers, url = "http://localhost:3000/dashboard") {
  return { headers: new Headers(headers), nextUrl: new URL(url) };
}

test("with a configured site, its own host is used", () => {
  assert.equal(requestOrigin(request({ host: "spacego.example", "x-forwarded-proto": "https" }), SITE), SITE);
  assert.equal(requestOrigin(request({ "x-forwarded-host": "spacego.example", host: "spacego.example" }, "https://spacego.example/x"), SITE), SITE);
});

test("with a configured site, a forwarded host for another site is ignored", () => {
  // OpenNext copies X-Forwarded-Host into Host, so both carry the client's value.
  assert.equal(requestOrigin(request({ "x-forwarded-host": "evil.example", host: "evil.example", "x-forwarded-proto": "https" }), SITE), SITE);
  assert.equal(requestOrigin(request({ "x-forwarded-host": "evil.example", host: "spacego.example" }), SITE), SITE);
});

test("with a configured site, local development hosts still work", () => {
  assert.equal(requestOrigin(request({ host: "localhost:3100" }), SITE), "http://localhost:3100");
  assert.equal(requestOrigin(request({ host: "127.0.0.1:3000" }, "http://127.0.0.1:3000/"), SITE), "http://127.0.0.1:3000");
});

test("without a configured site, the headers are used as before", () => {
  assert.equal(requestOrigin(request({ host: "localhost:3000" }), undefined), "http://localhost:3000");
  assert.equal(
    requestOrigin(request({ "x-forwarded-host": "app.example", "x-forwarded-proto": "https", host: "internal:8080" }), undefined),
    "https://app.example"
  );
});

test("malformed headers never become the origin", () => {
  const fallback = "http://localhost:3000";
  assert.equal(requestOrigin(request({ host: "evil.example/path" }), undefined), fallback);
  assert.equal(requestOrigin(request({ host: "user:pass@evil.example" }), undefined), fallback);
  assert.equal(requestOrigin(request({ host: "app.example", "x-forwarded-proto": "javascript" }), undefined), fallback);
  assert.equal(requestOrigin(request({ host: "evil.example/path" }), SITE), SITE);
});

test("a site URL without a scheme is read as https", () => {
  assert.equal(requestOrigin(request({ host: "evil.example" }), "spacego.example"), SITE);
});
