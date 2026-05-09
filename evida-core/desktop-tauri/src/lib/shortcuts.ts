import { useEffect } from "react";

export type ShortcutHandlers = {
  onNewCase: () => void;
  onNewCaseWindow: () => void;
  onOpenCaseSwitcher: () => void;
  onImportDocuments: () => void;
  onFindInCase: () => void;
  onCommandPalette: () => void;
  onSettings: () => void;
  onCloseWindow: () => void;
  onQuit: () => void;
};

function isTypingTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  if (!element) {
    return false;
  }
  const tagName = element.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || element.isContentEditable;
}

export function useEvidaShortcuts(handlers: ShortcutHandlers) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const modifier = event.ctrlKey || event.metaKey;
      if (!modifier) {
        return;
      }

      const key = event.key.toLowerCase();
      const allowInText = key === "k" || key === ",";
      if (isTypingTarget(event.target) && !allowInText) {
        return;
      }

      if (event.shiftKey && key === "n") {
        event.preventDefault();
        handlers.onNewCaseWindow();
        return;
      }

      const action = {
        n: handlers.onNewCase,
        o: handlers.onOpenCaseSwitcher,
        i: handlers.onImportDocuments,
        f: handlers.onFindInCase,
        k: handlers.onCommandPalette,
        ",": handlers.onSettings,
        w: handlers.onCloseWindow,
        q: handlers.onQuit
      }[key];

      if (action) {
        event.preventDefault();
        action();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handlers]);
}
