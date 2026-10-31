import test from "node:test";
import assert from "node:assert/strict";
import { parseModels } from "../src/lib/models.ts";
import {
  loadCursorApiKey,
  resolveAgentModel,
  buildAgentArgs,
} from "../src/lib/cursor-cli.ts";

test("parseModels correctly parses model list and strips zero-width spaces", () => {
  const sampleOutput = `Available models

composer-2.5 - Composer 2.5 (current, default)
grok-4.7-low - Grok 4.7  Low
grok-4.7-low-fast - Grok 4.7  Low Fast\u200b\u200b
grok-4.7-high - Grok 4.7  High

Tip: use --model <id> to switch.`;

  const parsed = parseModels(sampleOutput);

  assert.equal(parsed.length, 4);
  assert.deepEqual(parsed[0], {
    id: "composer-2.5",
    label: "Composer 2.5",
    isDefault: true,
    isCurrent: true,
  });
  assert.equal(parsed[2].id, "grok-4.7-low-fast");
  assert.equal(parsed[2].label, "Grok 4.7  Low Fast");
  assert.equal(parsed[2].isDefault, false);
});

test("loadCursorApiKey finds key in ~/.cursor/secrets/cursor.env", () => {
  const key = loadCursorApiKey();
  assert.ok(key, "API key should be found");
  assert.ok(key.startsWith("crsr_"), "API key should start with crsr_");
});

test("resolveAgentModel filters out 'auto' and 'default'", async () => {
  assert.equal(await resolveAgentModel("auto"), undefined);
  assert.equal(await resolveAgentModel("default"), undefined);
  assert.equal(await resolveAgentModel("  auto  "), undefined);
  assert.equal(await resolveAgentModel("composer-2.5"), "composer-2.5");
  assert.equal(await resolveAgentModel("grok-4.7-high"), "grok-4.7-high");
});

test("buildAgentArgs puts flags first and places '--' before prompt", async () => {
  const promptWithDash = "- Bullet item prompt that looks like an option";
  const args = await buildAgentArgs({
    prompt: promptWithDash,
    model: "auto",
    workspace: "/Users/rawshn/Projects/cursor-local-remote",
  });

  // Verify model='auto' did not inject '--model auto'
  assert.equal(args.includes("--model"), false);
  assert.equal(args.includes("auto"), false);

  // Verify '--' delimiter exists immediately before prompt
  const delimiterIndex = args.lastIndexOf("--");
  assert.ok(delimiterIndex !== -1, "'--' delimiter must be present");
  assert.equal(args[delimiterIndex + 1], promptWithDash);

  // Verify -p and other flags precede '--'
  const pIndex = args.indexOf("-p");
  assert.ok(pIndex !== -1 && pIndex < delimiterIndex);
});

test("buildAgentArgs includes explicit model when specified", async () => {
  const args = await buildAgentArgs({
    prompt: "Hello",
    model: "grok-4.7-high",
  });

  const modelIdx = args.indexOf("--model");
  assert.ok(modelIdx !== -1, "--model should be passed");
  assert.equal(args[modelIdx + 1], "grok-4.7-high");
});
