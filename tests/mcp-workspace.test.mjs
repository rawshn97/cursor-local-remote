import test from "node:test";
import assert from "node:assert/strict";
import { isFilesystemProjectDirName } from "../src/lib/mcp-workspace.ts";

test("isFilesystemProjectDirName skips dot dirs and _archive", () => {
  assert.equal(isFilesystemProjectDirName(".git"), false);
  assert.equal(isFilesystemProjectDirName("_archive"), false);
  assert.equal(isFilesystemProjectDirName("para-status"), true);
  assert.equal(isFilesystemProjectDirName("PARA Dashboard"), true);
});