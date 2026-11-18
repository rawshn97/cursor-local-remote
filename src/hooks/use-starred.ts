"use client";

import { useCallback, useEffect, useState } from "react";
import {
  hydrateStarredFromServer,
  loadStarredProjectsLocal,
  loadStarredSessionsLocal,
  saveStarredProjects,
  saveStarredSessions,
} from "@/lib/starred";

export function useStarred() {
  const [starredProjects, setStarredProjects] = useState(loadStarredProjectsLocal);
  const [starredSessions, setStarredSessions] = useState(loadStarredSessionsLocal);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    void hydrateStarredFromServer().then(({ projects, sessions }) => {
      setStarredProjects(projects);
      setStarredSessions(sessions);
      setHydrated(true);
    });
  }, []);

  const toggleProject = useCallback((path: string) => {
    setStarredProjects((prev) => {
      const next = prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path];
      saveStarredProjects(next);
      return next;
    });
  }, []);

  const toggleSession = useCallback((sessionId: string) => {
    setStarredSessions((prev) => {
      const next = prev.includes(sessionId)
        ? prev.filter((id) => id !== sessionId)
        : [...prev, sessionId];
      saveStarredSessions(next);
      return next;
    });
  }, []);

  const isSessionStarred = useCallback(
    (sessionId: string | null) => (sessionId ? starredSessions.includes(sessionId) : false),
    [starredSessions],
  );

  return {
    hydrated,
    starredProjects,
    starredSessions,
    toggleProject,
    toggleSession,
    isSessionStarred,
    setStarredProjects,
    setStarredSessions,
  };
}