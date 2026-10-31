import type { ModelInfo } from "@/lib/types";

export function parseModels(output: string): ModelInfo[] {
  const models: ModelInfo[] = [];

  for (const line of output.split("\n")) {
    const trimmed = line.replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
    if (!trimmed || trimmed.startsWith("Available") || trimmed.startsWith("Tip:")) continue;

    const match = trimmed.match(
      /^(\S+)\s+-\s+(.+?)(?:\s+\((default|current)(?:,\s*(default|current))?\))?$/,
    );
    if (!match) continue;

    const [, id, label, tag1, tag2] = match;
    const tags = [tag1, tag2].filter(Boolean);

    models.push({
      id,
      label: label.trim(),
      isDefault: tags.includes("default"),
      isCurrent: tags.includes("current"),
    });
  }

  return models;
}
