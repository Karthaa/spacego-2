// Unit tests for the open-redirect guard used by /auth/login and /auth/callback.
import { test } from "node:test";
import assert from "node:assert/strict";
import { homeForRole, safeNextPath } from "../../src/lib/auth/redirects.ts";

test("same-site absolute paths are allowed", () => {
  assert.equal(safeNextPath("/dashboard"), "/dashboard");
  assert.equal(safeNextPath("/owner/spaces/new?step=2#photos"), "/owner/spaces/new?step=2#photos");
});

test("anything that could leave the site is refused", () => {
  for (const value of [
    "https://evil.example/",
    "//evil.example/",
    "/\\evil.example",
    "evil.example",
    "javascript:alert(1)",
    "/\n/evil.example",
    "/\t/evil.example",
    "/\r/evil.example",
    // These resolve to "//evil.example" once dot segments and backslashes are applied.
    "/..//evil.example",
    "/.//evil.example",
    "/%2e%2e//evil.example",
    "/./\\evil.example",
    "/..\\/evil.example",
    "",
    null,
    undefined,
  ]) {
    assert.equal(safeNextPath(value), null, `expected ${JSON.stringify(value)} to be refused`);
  }
});

test("each role has its own home", () => {
  assert.equal(homeForRole("admin"), "/admin");
  assert.equal(homeForRole("owner"), "/owner");
  assert.equal(homeForRole("seeker"), "/dashboard");
  assert.equal(homeForRole(null), "/dashboard");
});
