import type { CollaborationMode } from "./suggestedActions";

export type WorkstyleAnswerLength = "short" | "balanced" | "detailed";
export type WorkstyleCitationPlacement = "sources_first" | "assessment_first";
export type WorkstyleLegalLanguageLevel = "plain" | "balanced" | "legal";

export interface WorkstylePreferences {
  answerLength: WorkstyleAnswerLength;
  citationPlacement: WorkstyleCitationPlacement;
  showNextSuggestions: boolean;
  showDetailedWorkStates: boolean;
  preferredCollaborationMode: CollaborationMode;
  legalLanguageLevel: WorkstyleLegalLanguageLevel;
  adaptationEnabled: boolean;
}

type WorkstyleStorage = Pick<Storage, "getItem" | "setItem">;

export const WORKSTYLE_STORAGE_KEY = "evida-workstyle-preferences-v1";

export const DEFAULT_WORKSTYLE_PREFERENCES: WorkstylePreferences = {
  answerLength: "balanced",
  citationPlacement: "assessment_first",
  showNextSuggestions: true,
  showDetailedWorkStates: true,
  preferredCollaborationMode: "free_question",
  legalLanguageLevel: "balanced",
  adaptationEnabled: true
};

export function readWorkstylePreferences(storage: Pick<WorkstyleStorage, "getItem">): WorkstylePreferences {
  const raw = storage.getItem(WORKSTYLE_STORAGE_KEY);
  if (!raw) {
    return DEFAULT_WORKSTYLE_PREFERENCES;
  }

  try {
    return {
      ...DEFAULT_WORKSTYLE_PREFERENCES,
      ...(JSON.parse(raw) as Partial<WorkstylePreferences>)
    };
  } catch {
    return DEFAULT_WORKSTYLE_PREFERENCES;
  }
}

export function writeWorkstylePreferences(
  storage: WorkstyleStorage,
  preferences: WorkstylePreferences
): WorkstylePreferences {
  const normalized = {
    ...DEFAULT_WORKSTYLE_PREFERENCES,
    ...preferences
  };
  storage.setItem(WORKSTYLE_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}
