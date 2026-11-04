import test from "node:test";
import assert from "node:assert/strict";
import {
  chatRequestSchema,
  deleteSessionSchema,
  parseBody,
  SESSION_ID_RE,
} from "../src/lib/validation.ts";

test("SESSION_ID_RE matches valid session identifiers and rejects malicious path traversals", () => {
  assert.ok(SESSION_ID_RE.test("session-123"));
  assert.ok(SESSION_ID_RE.test("a740fb68-4b95-4e5a-b755-b2d2be0a6acf"));
  assert.ok(SESSION_ID_RE.test("sess_abc_XYZ_09"));

  // Malicious characters
  assert.equal(SESSION_ID_RE.test("../../../etc/passwd"), false);
  assert.equal(SESSION_ID_RE.test("session;rm -rf /"), false);
  assert.equal(SESSION_ID_RE.test("session name with spaces"), false);
  assert.equal(SESSION_ID_RE.test(""), false);
});

test("chatRequestSchema validates prompt, model, and mode properly", () => {
  const valid = {
    prompt: "Write a unit test",
    model: "composer-2.5",
    mode: "agent",
    sessionId: "valid-session-id",
  };
  const result = chatRequestSchema.safeParse(valid);
  assert.ok(result.success);

  const missingPrompt = { model: "composer-2.5" };
  assert.equal(chatRequestSchema.safeParse(missingPrompt).success, false);

  const invalidMode = { prompt: "Hello", mode: "unsupported-mode" };
  assert.equal(chatRequestSchema.safeParse(invalidMode).success, false);
});

test("parseBody returns formatted data or first error message", () => {
  const success = parseBody(deleteSessionSchema, { sessionId: "valid-id-123" });
  assert.ok("data" in success);
  assert.equal(success.data.sessionId, "valid-id-123");

  const failure = parseBody(deleteSessionSchema, { sessionId: "invalid/id" });
  assert.ok("error" in failure);
  assert.equal(failure.error, "invalid sessionId");
});
