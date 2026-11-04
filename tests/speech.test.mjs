import test from "node:test";
import assert from "node:assert/strict";
import { formatSpokenText, insertAtCursor } from "../src/lib/speech.ts";

test("formatSpokenText transforms verbal punctuation to characters with proper spacing", () => {
  const spoken = "please refactor this function comma and run the tests period";
  const formatted = formatSpokenText(spoken);
  assert.equal(formatted, "Please refactor this function, and run the tests.");
});

test("formatSpokenText handles questions, exclamation marks, and newlines", () => {
  const spoken = "what is the build status question mark newline rerun all tests exclamation mark";
  const formatted = formatSpokenText(spoken);
  assert.equal(formatted, "What is the build status?\nRerun all tests!");
});

test("formatSpokenText capitalizes sentences and start of text", () => {
  const spoken = "check the server. it failed. why";
  const formatted = formatSpokenText(spoken);
  assert.equal(formatted, "Check the server. It failed. Why");
});

test("insertAtCursor appends with space when no cursor is specified", () => {
  const { text, newCursor } = insertAtCursor("Initial text", "added voice input");
  assert.equal(text, "Initial text added voice input");
  assert.equal(newCursor, text.length);
});

test("insertAtCursor inserts text cleanly at active cursor position", () => {
  const original = "Hello world";
  // Cursor placed between "Hello" and " world" (index 5)
  const { text, newCursor } = insertAtCursor(original, "beautiful", 5, 5);
  assert.equal(text, "Hello beautiful world");
  assert.equal(newCursor, 15);
});

test("insertAtCursor avoids double spaces when inserting adjacent to whitespace", () => {
  const original = "Hello ";
  const { text } = insertAtCursor(original, "world", 6, 6);
  assert.equal(text, "Hello world");
});
