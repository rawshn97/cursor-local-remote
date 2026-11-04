export function formatSpokenText(raw: string): string {
  if (!raw) return "";

  let text = raw;

  // Replace verbal punctuation commands (case-insensitive with word boundaries)
  const replacements: [RegExp, string][] = [
    [/\b(?:new paragraph)\b/gi, "\n\n"],
    [/\b(?:new line|newline)\b/gi, "\n"],
    [/\b(?:period|full stop)\b/gi, "."],
    [/\b(?:comma)\b/gi, ","],
    [/\b(?:question mark)\b/gi, "?"],
    [/\b(?:exclamation point|exclamation mark)\b/gi, "!"],
    [/\b(?:semicolon)\b/gi, ";"],
    [/\b(?:colon)\b/gi, ":"],
  ];

  for (const [pattern, replacement] of replacements) {
    text = text.replace(pattern, replacement);
  }

  // Clean up whitespace before punctuation: "word ." -> "word."
  text = text.replace(/\s+([.,!?:;])/g, "$1");

  // Remove spaces immediately surrounding newlines: "word \n word" -> "word\nword"
  text = text.replace(/[^\S\r\n]*\n[^\S\r\n]*/g, "\n");

  // Ensure a space after punctuation if followed by a word character
  text = text.replace(/([.,!?:;])(?=[A-Za-z0-9])/g, "$1 ");

  // Normalize duplicate spaces (except newlines)
  text = text.replace(/[^\S\r\n]+/g, " ");

  // Capitalize start of text and start of sentences after . ! ? \n
  text = text.replace(/(^\s*|[.!?\n]\s+)([a-z])/g, (_, prefix, char) => {
    return prefix + char.toUpperCase();
  });

  return text.trim();
}

export function insertAtCursor(
  original: string,
  toInsert: string,
  cursorStart?: number,
  cursorEnd?: number
): { text: string; newCursor: number } {
  if (cursorStart === undefined || cursorEnd === undefined) {
    // Append with space if needed
    const separator = original.length > 0 && !original.endsWith(" ") && !original.endsWith("\n") ? " " : "";
    const text = original + separator + toInsert;
    return { text, newCursor: text.length };
  }

  const before = original.slice(0, cursorStart);
  const after = original.slice(cursorEnd);

  // Add leading space if previous char isn't a space/newline and inserted text doesn't start with space/punctuation
  const needsLeadingSpace =
    before.length > 0 &&
    !before.endsWith(" ") &&
    !before.endsWith("\n") &&
    !toInsert.startsWith(" ") &&
    !/^[.,!?:;]/.test(toInsert);

  const prefix = needsLeadingSpace ? " " : "";
  const inserted = prefix + toInsert;
  const text = before + inserted + after;
  const newCursor = cursorStart + inserted.length;

  return { text, newCursor };
}

export function assembleSpeechResults(
  results: Array<{ isFinal: boolean; transcript: string }>
): { finalTranscript: string; interimTranscript: string; combined: string } {
  let finalStr = "";
  let interimStr = "";

  for (const res of results) {
    const trimmed = res.transcript.trim();
    if (!trimmed) continue;
    if (res.isFinal) {
      finalStr += (finalStr && !finalStr.endsWith(" ") ? " " : "") + trimmed;
    } else {
      interimStr += (interimStr && !interimStr.endsWith(" ") ? " " : "") + trimmed;
    }
  }

  const finalFormatted = formatSpokenText(finalStr);
  const interimFormatted = interimStr.trim();
  const separator = finalFormatted && interimFormatted ? " " : "";
  const combined = finalFormatted + separator + interimFormatted;

  return {
    finalTranscript: finalFormatted,
    interimTranscript: interimFormatted,
    combined,
  };
}
