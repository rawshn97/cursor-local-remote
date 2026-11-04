import test from "node:test";
import assert from "node:assert/strict";
import { exportSessionMarkdown } from "../src/lib/export.ts";
import {
  formatSessionTitle,
  stripSessionMetadata,
  timeAgo,
} from "../src/lib/format.ts";

test("exportSessionMarkdown formats interleaved messages and tool calls in chronological order", () => {
  const messages = [
    {
      id: "m1",
      role: "user",
      content: "Please inspect package.json",
      timestamp: 1000,
    },
    {
      id: "m2",
      role: "assistant",
      content: "I found 5 dependencies.",
      timestamp: 3000,
    },
  ];

  const toolCalls = [
    {
      id: "tc1",
      type: "read",
      path: "package.json",
      timestamp: 2000,
    },
    {
      id: "tc2",
      type: "shell",
      command: "npm test",
      timestamp: 2500,
    },
  ];

  const md = exportSessionMarkdown(messages, toolCalls);

  assert.ok(md.includes("## User\n\nPlease inspect package.json"));
  assert.ok(md.includes("> **Read** `package.json`"));
  assert.ok(md.includes("> **Shell** `npm test`"));
  assert.ok(md.includes("## Assistant\n\nI found 5 dependencies."));

  // Verify chronological ordering
  const userIdx = md.indexOf("## User");
  const readIdx = md.indexOf("> **Read**");
  const shellIdx = md.indexOf("> **Shell**");
  const assistIdx = md.indexOf("## Assistant");

  assert.ok(userIdx < readIdx, "User prompt precedes read tool call");
  assert.ok(readIdx < shellIdx, "Read tool call precedes shell command");
  assert.ok(shellIdx < assistIdx, "Shell command precedes assistant response");
});

test("stripSessionMetadata strips XML timestamps and user query tags", () => {
  const raw = `<timestamp>2026-11-04 14:00:00</timestamp>
<user_query>
Refactor auth middleware
</user_query>`;

  const cleaned = stripSessionMetadata(raw);
  assert.equal(cleaned, "Refactor auth middleware");
});

test("formatSessionTitle formats clean titles and falls back to dates", () => {
  assert.equal(
    formatSessionTitle({ title: "Fix audio dictation latency" }),
    "Fix audio dictation latency"
  );

  // Truncates titles longer than 50 characters
  const longTitle = "A".repeat(60);
  assert.equal(formatSessionTitle({ title: longTitle }).length, 50);

  // Rejects datetime-like titles in favor of date fallback
  const dateFallback = formatSessionTitle({
    title: "Monday, Nov 4, 2026 12:00 PM",
    updatedAt: new Date("2026-11-04T12:00:00Z").getTime(),
  });
  assert.ok(dateFallback.includes("Nov"));

  // Default fallback when empty
  assert.equal(formatSessionTitle({}), "New session");
});

test("timeAgo calculates relative time strings correctly", () => {
  const now = Date.now();
  assert.equal(timeAgo(now - 10000), "now");
  assert.equal(timeAgo(now - 120000), "2m ago");
  assert.equal(timeAgo(now - 7200000), "2h ago");
  assert.equal(timeAgo(now - 172800000), "2d ago");
});
