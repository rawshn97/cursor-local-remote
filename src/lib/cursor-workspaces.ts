import { execFileSync } from "child_process";
import { existsSync } from "fs";
import { homedir } from "os";
import { join, resolve, basename, sep } from "path";
import type { ProjectInfo } from "@/lib/types";
import { workspaceToProjectKey } from "@/lib/transcript-reader";
import { vlog } from "@/lib/verbose";

export interface CursorWorkspaceEntry extends ProjectInfo {
  displayPath?: string;
  lastUsedAt?: number;
}

function defaultStateDbPath(): string {
  return join(
    homedir(),
    "Library",
    "Application Support",
    "Cursor",
    "User",
    "globalStorage",
    "state.vscdb",
  );
}

function stateDbPath(): string {
  const fromEnv = process.env.CLR_CURSOR_STATE_DB?.trim();
  return fromEnv ? resolve(fromEnv) : defaultStateDbPath();
}

function sqliteQuote(key: string): string {
  return `'${key.replace(/'/g, "''")}'`;
}

/** Read one ItemTable JSON blob without loading the whole vscdb (file can be multi-GB). */
function readItemJson(key: string): unknown {
  const dbPath = stateDbPath();
  if (!existsSync(dbPath)) return null;

  try {
    const raw = execFileSync(
      "sqlite3",
      [dbPath, `SELECT value FROM ItemTable WHERE key=${sqliteQuote(key)}`],
      { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
    ).trim();
    if (!raw) return null;
    return JSON.parse(raw) as unknown;
  } catch (err) {
    vlog("cursor-workspaces", "sqlite3 query failed", key, String(err));
    return null;
  }
}

function decodeFolderUri(uri: unknown): string | null {
  if (!uri || typeof uri !== "string") return null;
  if (!uri.startsWith("file://")) return null;
  try {
    const decoded = decodeURIComponent(uri.replace(/^file:\/\//, ""));
    return resolve(decoded);
  } catch {
    return null;
  }
}

function pathFromUriObject(uri: unknown): string | null {
  if (!uri || typeof uri !== "object") return null;
  const obj = uri as { fsPath?: string; external?: string; path?: string };
  if (obj.fsPath) return resolve(obj.fsPath);
  if (obj.external) return decodeFolderUri(obj.external);
  if (obj.path) return resolve(obj.path);
  return null;
}

function expandDisplayPath(displayPath: string): string {
  if (displayPath.startsWith("~/")) {
    return resolve(homedir(), displayPath.slice(2));
  }
  return resolve(displayPath);
}

function recencyFromAdditionalProjects(data: unknown): Map<string, number> {
  const map = new Map<string, number>();
  if (!Array.isArray(data)) return map;
  for (const item of data) {
    if (!item || typeof item !== "object") continue;
    const row = item as {
      type?: string;
      lastUsedAt?: number;
      displayPath?: string;
      workspaceIdentifier?: { uri?: unknown };
    };
    if (row.type !== "workspace") continue;
    const path =
      pathFromUriObject(row.workspaceIdentifier?.uri) ??
      (row.displayPath ? expandDisplayPath(row.displayPath) : null);
    if (!path || !row.lastUsedAt) continue;
    map.set(path, Math.max(map.get(path) ?? 0, row.lastUsedAt));
  }
  return map;
}

function projectsScanRoot(): string {
  return resolve(homedir(), "Projects");
}

/** Top-level folder under ~/Projects for a file opened from a nested path. */
export function projectRootFromProjectsFilePath(filePath: string): string | null {
  const root = projectsScanRoot();
  const resolved = resolve(filePath);
  if (!resolved.startsWith(root + sep)) return null;
  const rel = resolved.slice(root.length + 1);
  const segment = rel.split(/[/\\]/)[0];
  if (!segment || segment.startsWith(".")) return null;
  return resolve(join(root, segment));
}

function workspacePathsFromGlassAndHistory(
  additional: unknown,
  recent: unknown,
): Map<string, number> {
  const map = new Map<string, number>();

  if (Array.isArray(additional)) {
    for (const item of additional) {
      if (!item || typeof item !== "object") continue;
      const row = item as {
        type?: string;
        lastUsedAt?: number;
        displayPath?: string;
        workspaceIdentifier?: { uri?: unknown };
      };
      if (row.type !== "workspace") continue;
      const path =
        pathFromUriObject(row.workspaceIdentifier?.uri) ??
        (row.displayPath ? expandDisplayPath(row.displayPath) : null);
      if (!path || !row.lastUsedAt) continue;
      map.set(path, Math.max(map.get(path) ?? 0, row.lastUsedAt));
    }
  }

  const entries = Array.isArray(recent)
    ? recent
    : recent && typeof recent === "object" && Array.isArray((recent as { entries?: unknown[] }).entries)
      ? (recent as { entries: unknown[] }).entries
      : [];
  let rank = entries.length;
  for (const item of entries) {
    if (!item || typeof item !== "object") continue;
    const row = item as { folderUri?: string; fileUri?: string };
    const score = rank * 1_000;
    const folder = decodeFolderUri(row.folderUri);
    if (folder) map.set(folder, Math.max(map.get(folder) ?? 0, score));
    const file = decodeFolderUri(row.fileUri);
    if (file) {
      const project = projectRootFromProjectsFilePath(file);
      if (project) map.set(project, Math.max(map.get(project) ?? 0, score));
    }
    rank -= 1;
  }

  return map;
}

function recencyFromRecentPaths(data: unknown): Map<string, number> {
  const map = new Map<string, number>();
  const entries = Array.isArray(data)
    ? data
    : data && typeof data === "object" && Array.isArray((data as { entries?: unknown[] }).entries)
      ? (data as { entries: unknown[] }).entries
      : [];
  let rank = entries.length;
  for (const item of entries) {
    if (!item || typeof item !== "object") continue;
    const row = item as { folderUri?: string };
    const path = decodeFolderUri(row.folderUri);
    if (!path) continue;
    const score = rank * 1_000;
    map.set(path, Math.max(map.get(path) ?? 0, score));
    rank -= 1;
  }
  return map;
}

/** Normalize git remote / Cursor repo URL for stable comparison. */
export function normalizeRepoRef(url: string): string {
  let s = url.trim().toLowerCase();
  s = s.replace(/^https?:\/\//, "");
  s = s.replace(/\.git$/, "");
  return s;
}

export function removedFromGlassProjects(data: unknown): {
  paths: Set<string>;
  repoUrls: Set<string>;
} {
  const paths = new Set<string>();
  const repoUrls = new Set<string>();
  if (!Array.isArray(data)) return { paths, repoUrls };
  for (const item of data) {
    if (!item || typeof item !== "object") continue;
    const row = item as {
      type?: string;
      displayPath?: string;
      workspaceIdentifier?: { uri?: unknown };
      repoUrls?: string[];
      repoUrl?: string;
    };
    if (row.type === "workspace") {
      const path =
        pathFromUriObject(row.workspaceIdentifier?.uri) ??
        (row.displayPath ? expandDisplayPath(row.displayPath) : null);
      if (path) paths.add(path);
      continue;
    }
    if (row.type === "repo") {
      const urls = row.repoUrls ?? (row.repoUrl ? [row.repoUrl] : []);
      for (const u of urls) {
        if (u) repoUrls.add(normalizeRepoRef(u));
      }
    }
  }
  return { paths, repoUrls };
}

function gitOriginRepoRef(path: string): string | undefined {
  if (!existsSync(join(path, ".git"))) return undefined;
  try {
    const url = execFileSync("git", ["-C", path, "remote", "get-url", "origin"], {
      encoding: "utf8",
    }).trim();
    return url ? normalizeRepoRef(url) : undefined;
  } catch {
    return undefined;
  }
}

function workspaceRepoRefs(
  path: string,
  tracked?: Array<{ repoPath?: string; repoUrl?: string }>,
): Set<string> {
  const refs = new Set<string>();
  const live = gitOriginRepoRef(path);
  if (live) refs.add(live);
  if (Array.isArray(tracked)) {
    for (const t of tracked) {
      if (t.repoUrl) refs.add(normalizeRepoRef(t.repoUrl));
    }
  }
  return refs;
}

function workspaceRemovedByGlass(
  path: string,
  removedPaths: Set<string>,
  removedRepoUrls: Set<string>,
  tracked?: Array<{ repoPath?: string; repoUrl?: string }>,
): boolean {
  if (removedPaths.has(path)) return true;
  for (const ref of workspaceRepoRefs(path, tracked)) {
    if (removedRepoUrls.has(ref)) return true;
  }
  return false;
}

function repoLabelForWorkspace(
  path: string,
  tracked?: Array<{ repoPath?: string; repoUrl?: string }>,
): string | undefined {
  const live = gitOriginRepoRef(path);
  if (live) return live;
  if (!Array.isArray(tracked)) return undefined;
  const match =
    tracked.find((t) => t.repoPath && resolve(t.repoPath) === resolve(path)) ?? tracked[0];
  if (match?.repoUrl) return normalizeRepoRef(match.repoUrl);
  return undefined;
}

function labelForPath(path: string, displayPath?: string): string {
  if (resolve(path) === resolve(homedir())) return "Home";
  if (displayPath?.startsWith("~/")) {
    const short = displayPath.slice(2);
    const base = basename(short);
    return base || short;
  }
  if (displayPath && displayPath !== path) {
    return basename(displayPath) || displayPath;
  }
  return basename(path) || path;
}

/** Folder workspaces from Cursor IDE (matches the desktop project list). */
export async function listCursorWorkspaces(): Promise<CursorWorkspaceEntry[]> {
  const metadata = readItemJson("workspaceMetadata.entries") as { entries?: unknown[] } | null;
  if (!metadata?.entries?.length) return [];

  const additional = readItemJson("cursor/glass.additionalProjects");
  const removed = readItemJson("cursor/glass.removedProjects");
  const recent = readItemJson("history.recentlyOpenedPathsList");

  const { paths: removedPaths, repoUrls: removedRepoUrls } = removedFromGlassProjects(removed);
  const recency = new Map<string, number>();
  for (const [path, ts] of recencyFromAdditionalProjects(additional)) {
    recency.set(path, ts);
  }
  for (const [path, ts] of recencyFromRecentPaths(recent)) {
    recency.set(path, Math.max(recency.get(path) ?? 0, ts));
  }

  const byPath = new Map<string, CursorWorkspaceEntry>();

  const historyPaths = workspacePathsFromGlassAndHistory(additional, recent);

  for (const raw of metadata.entries) {
    if (!raw || typeof raw !== "object") continue;
    const entry = raw as {
      folderUri?: string;
      displayPath?: string;
      paths?: Array<{ uri?: unknown; displayPath?: string }>;
    };

    const path =
      decodeFolderUri(entry.folderUri) ??
      pathFromUriObject(entry.paths?.[0]?.uri) ??
      (entry.displayPath ? expandDisplayPath(entry.displayPath) : null);

    const tracked = (entry as { trackedGitRepos?: Array<{ repoPath?: string; repoUrl?: string }> })
      .trackedGitRepos;
    if (!path || workspaceRemovedByGlass(path, removedPaths, removedRepoUrls, tracked)) continue;
    if (!existsSync(path)) continue;

    const displayPath = entry.displayPath ?? entry.paths?.[0]?.displayPath;
    const repoLabel = repoLabelForWorkspace(path, tracked);
    byPath.set(path, {
      name: labelForPath(path, displayPath),
      path,
      key: workspaceToProjectKey(path),
      displayPath,
      repoLabel,
      lastUsedAt: recency.get(path) ?? 0,
    });
  }

  for (const [path, lastUsedAt] of historyPaths) {
    if (byPath.has(path)) continue;
    if (!existsSync(path)) continue;
    if (workspaceRemovedByGlass(path, removedPaths, removedRepoUrls)) continue;
    byPath.set(path, {
      name: labelForPath(path),
      path,
      key: workspaceToProjectKey(path),
      repoLabel: gitOriginRepoRef(path),
      lastUsedAt,
    });
  }

  return Array.from(byPath.values()).sort((a, b) => {
    const ta = a.lastUsedAt ?? 0;
    const tb = b.lastUsedAt ?? 0;
    if (tb !== ta) return tb - ta;
    return a.name.localeCompare(b.name);
  });
}

/** Known workspace paths from Cursor (for transcript key decoding). */
export async function knownCursorWorkspacePaths(): Promise<string[]> {
  const workspaces = await listCursorWorkspaces();
  return workspaces.map((w) => w.path);
}
