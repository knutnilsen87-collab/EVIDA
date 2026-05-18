import type { ViewKey } from "../../types";

export type RoomKey =
  | "saksrom"
  | "chronology"
  | "evidence"
  | "arguments"
  | "contradictions"
  | "risk"
  | "simulation"
  | "draft"
  | "export";

export type RoomAvailabilityMode = "ready" | "preliminary" | "locked";

export interface RoomAvailability {
  enabled: boolean;
  mode: RoomAvailabilityMode;
  label: string;
  reason?: string;
  warning?: string;
  primaryActionLabel?: string;
  requiresAcknowledgement?: boolean;
  acknowledgementText?: string;
}

export interface RoomAvailabilitySummary {
  importInProgress: boolean;
  documentControlComplete: boolean;
  sourceCount: number;
  sourceCoveragePercent: number;
  pagesRequiringOcr: number;
  failedFiles: number;
  unsupportedFiles: number;
}

export const EXPORT_PRELIMINARY_ACKNOWLEDGEMENT =
  "Jeg forstår at eksporten er basert på foreløpig kildegrunnlag.";

const VIEW_TO_ROOM: Partial<Record<ViewKey, RoomKey>> = {
  caseRoom: "saksrom",
  chronology: "chronology",
  evidence: "evidence",
  arguments: "arguments",
  contradictions: "contradictions",
  risk: "risk",
  litigationSimulation: "simulation",
  draft: "draft",
  export: "export"
};

export function roomKeyForView(view: ViewKey): RoomKey | undefined {
  return VIEW_TO_ROOM[view];
}

export function getRoomAvailability(
  room: RoomKey,
  summary: RoomAvailabilitySummary
): RoomAvailability {
  if (summary.importInProgress) {
    return {
      enabled: false,
      mode: "locked",
      label: "Krever dokumentkontroll",
      reason: "Importen er ikke ferdig."
    };
  }

  if (!summary.documentControlComplete) {
    return {
      enabled: false,
      mode: "locked",
      label: "Krever dokumentkontroll",
      reason: "Dokumentkontroll må fullføres først."
    };
  }

  if (summary.sourceCount <= 0) {
    return {
      enabled: false,
      mode: "locked",
      label: "Krever kilder",
      reason: "Ingen sporbare kildeutdrag er tilgjengelige."
    };
  }

  if (room === "contradictions" && summary.sourceCount < 2) {
    return {
      enabled: false,
      mode: "locked",
      label: "Krever minst 2 kilder",
      reason: "Krever minst 2 sporbare kilder"
    };
  }

  const hasCoverageLimit = summary.sourceCoveragePercent < 100 || summary.pagesRequiringOcr > 0;
  const coverage = Math.max(0, Math.min(100, Math.round(summary.sourceCoveragePercent)));
  const ocrWarning =
    summary.pagesRequiringOcr > 0
      ? `${summary.pagesRequiringOcr} ${summary.pagesRequiringOcr === 1 ? "side mangler" : "sider mangler"} tekst/OCR.`
      : "Kildedekningen er ikke fullstendig.";

  if (hasCoverageLimit) {
    const base = {
      enabled: true,
      mode: "preliminary" as const,
      label: summary.pagesRequiringOcr > 0 ? "OCR gjenstår" : "Foreløpig",
      warning: `${ocrWarning} Rommet kan brukes foreløpig med ${coverage} % kildedekning.`
    };

    if (room === "chronology") {
      return { ...base, primaryActionLabel: "Bygg foreløpig kronologi" };
    }
    if (room === "evidence") {
      return { ...base, primaryActionLabel: "Bygg foreløpig bevismatrise" };
    }
    if (room === "draft") {
      return {
        ...base,
        warning: `${base.warning} Utkast markeres som foreløpig.`
      };
    }
    if (room === "export") {
      return {
        ...base,
        primaryActionLabel: "Lag foreløpig eksport",
        requiresAcknowledgement: true,
        acknowledgementText: EXPORT_PRELIMINARY_ACKNOWLEDGEMENT
      };
    }
    return base;
  }

  return {
    enabled: true,
    mode: "ready",
    label: "Klar"
  };
}

export function getSidebarStateLabel(availability: RoomAvailability) {
  if (availability.mode !== "locked") {
    return availability.label;
  }
  if (availability.label === "Krever minst 2 kilder") {
    return "Krever minst 2 kilder";
  }
  return availability.label;
}

export function isAnalysisRoomView(view: ViewKey) {
  return Boolean(roomKeyForView(view));
}
