// Unit tests for the sign-in error messages (src/lib/auth/messages.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { AUTH_LINK_ERROR_FALLBACK, authErrorMessage, authLinkErrorMessage } from "../../src/lib/auth/messages.ts";

test("known Supabase errors get friendly messages", () => {
  assert.equal(authErrorMessage("Invalid login credentials"), "The email or password is incorrect.");
  assert.equal(authLinkErrorMessage("Email link is invalid or has expired"), "This link is invalid or has expired. Please request a new one.");
});

test("errors from API calls fall back to Supabase's own wording", () => {
  assert.equal(authErrorMessage("Signups not allowed for this instance"), "Signups not allowed for this instance");
  assert.equal(authErrorMessage(""), "Something went wrong. Please try again.");
});

test("text from a crafted link is never repeated on the page", () => {
  const crafted = "Your account is locked. Call +1 555 0100 to unlock it.";
  assert.equal(authLinkErrorMessage(crafted), AUTH_LINK_ERROR_FALLBACK);
  assert.equal(authLinkErrorMessage(null), AUTH_LINK_ERROR_FALLBACK);
});
