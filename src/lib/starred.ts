import { apiFetch } from "@/lib/api-fetch";

export const STARRED_PROJECTS_KEY = "clr-starred-projects";
export const STARRED_SESSIONS_KEY = "clr-starred-sessions";

function parseIds(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string" && id.length > 0);
  } catch {
    return [];
  }
}

export function loadStarredProjectsLocal(): string[] {
  if (typeof window === "undefined") return [];
  return parseIds(localStorage.getItem(STARRED_PROJECTS_KEY));
}

export function saveStarredProjects(paths: string[]) {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify(paths);
  localStorage.setItem(STARRED_PROJECTS_KEY, payload);
  apiFetch("/api/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ starred_projects: payload }),
  }).catch(() => {});
}

export function loadStarredSessionsLocal(): string[] {
  if (typeof window === "undefined") return [];
  return parseIds(localStorage.getItem(STARRED_SESSIONS_KEY));
}

export function saveStarredSessions(ids: string[]) {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify(ids);
  localStorage.setItem(STARRED_SESSIONS_KEY, payload);
  apiFetch("/api/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ starred_sessions: payload }),
  }).catch(() => {});
}

export async function hydrateStarredFromServer(): Promise<{
  projects: string[];
  sessions: string[];
}> {
  const localProjects = loadStarredProjectsLocal();
  const localSessions = loadStarredSessionsLocal();
  try {
    const r = await apiFetch("/api/settings");
    const data = (await r.json()) as { settings?: Record<string, string | boolean> };
    let projects = localProjects;
    let sessions = localSessions;
    const sp = data.settings?.starred_projects;
    if (typeof sp === "string") {
      const parsed = parseIds(sp);
      if (parsed.length > 0 || localProjects.length === 0) {
        projects = parsed;
        localStorage.setItem(STARRED_PROJECTS_KEY, sp);
      } else if (localProjects.length > 0) {
        saveStarredProjects(localProjects);
      }
    }
    const ss = data.settings?.starred_sessions;
    if (typeof ss === "string") {
      const parsed = parseIds(ss);
      if (parsed.length > 0 || localSessions.length === 0) {
        sessions = parsed;
        localStorage.setItem(STARRED_SESSIONS_KEY, ss);
      } else if (localSessions.length > 0) {
        saveStarredSessions(localSessions);
      }
    }
    return { projects, sessions };
  } catch {
    return { projects: localProjects, sessions: localSessions };
  }
}