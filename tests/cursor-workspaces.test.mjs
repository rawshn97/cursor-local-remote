import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeRepoRef,
  removedFromGlassProjects,
} from "../src/lib/cursor-workspaces.ts";

test("normalizeRepoRef strips scheme, git suffix, and case", () => {
  assert.equal(
    normalizeRepoRef("https://github.com/rawshn97/PARA-Dashboard.git"),
    "github.com/rawshn97/para-dashboard",
  );
  assert.equal(
    normalizeRepoRef("github.com/rawshn97/para-dashboard"),
    "github.com/rawshn97/para-dashboard",
  );
});

test("removedFromGlassProjects collects workspace paths and removed repo URLs", () => {
  const removed = removedFromGlassProjects([
    {
      type: "workspace",
      displayPath: "~/Projects/old",
      workspaceIdentifier: { uri: { fsPath: "/Users/x/Projects/old" } },
    },
    {
      type: "repo",
      repoUrls: [
        "github.com/rawshn97/para-dashboard",
        "github.com/itsrrm97/para-dashboard",
      ],
    },
  ]);
  assert.ok(removed.paths.has("/Users/x/Projects/old"));
  assert.ok(removed.repoUrls.has("github.com/rawshn97/para-dashboard"));
  assert.equal(removed.repoUrls.size, 2);
});