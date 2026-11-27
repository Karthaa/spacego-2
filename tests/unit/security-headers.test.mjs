// Unit tests for the HTTP security headers (src/lib/security-headers.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { BASE_CSP, contentSecurityPolicy, securityHeaders } from "../../src/lib/security-headers.ts";

const byKey = (headers) => Object.fromEntries(headers.map((h) => [h.key, h.value]));

test("every build sends the basic protections", () => {
  for (const env of [{ NODE_ENV: "development" }, { NODE_ENV: "production" }]) {
    const h = byKey(securityHeaders(env));
    assert.equal(h["X-Frame-Options"], "DENY");
    assert.equal(h["X-Content-Type-Options"], "nosniff");
    assert.equal(h["Referrer-Policy"], "strict-origin-when-cross-origin");
    assert.match(h["Strict-Transport-Security"], /^max-age=31536000; includeSubDomains$/);
    assert.match(h["Permissions-Policy"], /geolocation=\(self\)/);
    assert.match(h["Content-Security-Policy"], /frame-ancestors 'none'/);
    assert.match(h["Content-Security-Policy"], /object-src 'none'/);
  }
});

test("development only gets the safe CSP subset", () => {
  const h = byKey(securityHeaders({ NODE_ENV: "development" }));
  assert.equal(h["Content-Security-Policy"], BASE_CSP);
  assert.equal(h["Content-Security-Policy-Report-Only"], undefined);
});

test("production reports the full policy without enforcing it by default", () => {
  const h = byKey(securityHeaders({ NODE_ENV: "production" }));
  assert.equal(h["Content-Security-Policy"], BASE_CSP);
  assert.match(h["Content-Security-Policy-Report-Only"], /default-src 'self'/);
});

test("CSP_MODE=enforce enforces the full policy", () => {
  const h = byKey(securityHeaders({ NODE_ENV: "production", CSP_MODE: "enforce" }));
  assert.match(h["Content-Security-Policy"], /default-src 'self'/);
  assert.match(h["Content-Security-Policy"], /frame-ancestors 'none'/);
  assert.equal(h["Content-Security-Policy-Report-Only"], undefined);
});

test("the full policy allows exactly the hosts this build uses", () => {
  const csp = contentSecurityPolicy({
    NODE_ENV: "production",
    NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghij.supabase.co",
    NEXT_PUBLIC_MAPTILER_KEY: "placeholder",
  });
  const connect = csp.split("; ").find((d) => d.startsWith("connect-src "));
  assert.equal(
    connect,
    "connect-src 'self' https://tiles.openfreemap.org https://abcdefghij.supabase.co https://api.maptiler.com"
  );
  assert.doesNotMatch(csp, /unsafe-eval/);
  assert.match(csp, /worker-src 'self' blob:/);
});

test("an invalid Supabase URL adds nothing", () => {
  const csp = contentSecurityPolicy({ NODE_ENV: "production", NEXT_PUBLIC_SUPABASE_URL: "not a url" });
  assert.match(csp, /connect-src 'self' https:\/\/tiles\.openfreemap\.org;/);
});
