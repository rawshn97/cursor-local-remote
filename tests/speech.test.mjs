import test from "node:test";
import assert from "node:assert/strict";
import { formatSpokenText, insertAtCursor, assembleSpeechResults } from "../src/lib/speech.ts";

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

test("assembleSpeechResults deduplicates progressive final items emitted by Android Chrome", () => {
  const androidProgressiveFinals = [
    { isFinal: true, transcript: "I" },
    { isFinal: true, transcript: "I am" },
    { isFinal: true, transcript: "I am testing" },
    { isFinal: true, transcript: "I am testing the voice agent now" },
  ];
  const { combined, finalTranscript } = assembleSpeechResults(androidProgressiveFinals);
  assert.equal(finalTranscript, "I am testing the voice agent now");
  assert.equal(combined, "I am testing the voice agent now");
  assert.equal(combined.includes("I I am"), false);
});


test("assembleSpeechResults correctly merges multiple final and interim chunks", () => {
  const chunks = [
    { isFinal: true, transcript: "First sentence period" },
    { isFinal: true, transcript: "Second sentence period" },
    { isFinal: false, transcript: "interim thought" },
  ];
  const { combined } = assembleSpeechResults(chunks);
  assert.equal(combined, "First sentence. Second sentence. interim thought");
});
