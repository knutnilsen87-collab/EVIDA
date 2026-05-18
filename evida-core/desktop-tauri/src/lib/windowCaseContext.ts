import { useCallback, useEffect, useMemo, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { CaseSummary, ViewKey, WindowCaseContext } from "../types";
import { markCaseOpened, setCurrentWindowTitle } from "./api";

function initialCaseIdFromUrl() {
  if (typeof window === "undefined") {
    return null;
  }
  const params = new URLSearchParams(window.location.search);
  const hashQuery = window.location.hash.replace(/^#\/?/, "");
  const hashParams = new URLSearchParams(hashQuery);
  hashParams.forEach((value, key) => {
    if (!params.has(key)) {
      params.set(key, value);
    }
  });
  return params.get("caseId");
}

function currentWindowLabel() {
  try {
    return getCurrentWindow().label;
  } catch {
    return "browser";
  }
}

export function useWindowCaseContext(initialView: ViewKey) {
  const windowId = useMemo(() => currentWindowLabel(), []);
  const [context, setContext] = useState<WindowCaseContext>(() => ({
    windowId,
    caseId: initialCaseIdFromUrl(),
    displayName: "Ny sak",
    caseNumber: null,
    workspaceView: initialView
  }));

  const bindCase = useCallback(
    async (caseSummary: CaseSummary, view: ViewKey = "caseRoom") => {
      const next: WindowCaseContext = {
        windowId,
        caseId: caseSummary.id,
        displayName: caseSummary.name,
        caseNumber: caseSummary.case_number,
        workspaceView: view
      };
      setContext(next);
      await markCaseOpened(caseSummary.id);
      await setCurrentWindowTitle(windowId, `Evida — ${caseSummary.name || "Ny sak"}`);
    },
    [windowId]
  );

  const clearCase = useCallback(() => {
    setContext((current) => ({
      ...current,
      caseId: null,
      displayName: "Ny sak",
      caseNumber: null,
      workspaceView: "caseRoom"
    }));
    void setCurrentWindowTitle(windowId, "Evida");
  }, [windowId]);

  useEffect(() => {
    setContext((current) => ({
      ...current,
      workspaceView: initialView
    }));
  }, [initialView]);

  return { context, bindCase, clearCase, setContext };
}
