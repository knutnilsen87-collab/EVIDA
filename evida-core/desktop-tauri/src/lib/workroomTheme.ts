import type { ViewKey } from "../types";
import type { CSSProperties } from "react";

export type WorkroomKey =
  | "overview"
  | "caseRoom"
  | "documents"
  | "chronology"
  | "evidence"
  | "arguments"
  | "contradictions"
  | "risk"
  | "control"
  | "export"
  | "draft"
  | "litigationSimulation";

export type WorkroomTheme = {
  label: string;
  accent: string;
  tint: string;
  strongTint: string;
  icon: string;
  purpose: string;
};

export const WORKROOM_THEME: Record<WorkroomKey, WorkroomTheme> = {
  overview: {
    label: "Saksoversikt",
    accent: "var(--evida-navy)",
    tint: "#f8fafc",
    strongTint: "#e2e8f0",
    icon: "layout-dashboard",
    purpose: "Se status, fremdrift og neste beste handling i saken"
  },
  caseRoom: {
    label: "Saksrom",
    accent: "var(--evida-blue)",
    tint: "#eff6ff",
    strongTint: "#dbeafe",
    icon: "message-square",
    purpose: "Arbeid med saken og still kildebundne spørsmål"
  },
  documents: {
    label: "Dokumenter",
    accent: "#4f46e5",
    tint: "#eef2ff",
    strongTint: "#e0e7ff",
    icon: "files",
    purpose: "Importer, kontroller og organiser dokumentgrunnlaget"
  },
  chronology: {
    label: "Kronologi",
    accent: "var(--evida-amber)",
    tint: "#fffbeb",
    strongTint: "#fef3c7",
    icon: "clock",
    purpose: "Bygg sakens hendelsesforløp"
  },
  evidence: {
    label: "Bevismatrise",
    accent: "var(--evida-green)",
    tint: "#f0fdf4",
    strongTint: "#dcfce7",
    icon: "table",
    purpose: "Koble påstander til dokumentasjon"
  },
  arguments: {
    label: "Anførsler",
    accent: "var(--evida-purple)",
    tint: "#f5f3ff",
    strongTint: "#ede9fe",
    icon: "scale",
    purpose: "Strukturer argumenter, støtte og motbevis"
  },
  contradictions: {
    label: "Motstrid",
    accent: "var(--evida-orange)",
    tint: "#fff7ed",
    strongTint: "#ffedd5",
    icon: "git-compare",
    purpose: "Finn konflikt mellom dokumenter, datoer og forklaringer"
  },
  risk: {
    label: "Risiko",
    accent: "var(--evida-red)",
    tint: "#fef2f2",
    strongTint: "#fee2e2",
    icon: "alert-triangle",
    purpose: "Finn svakheter før motparten gjør det"
  },
  control: {
    label: "Kontrollgrunnlag",
    accent: "var(--evida-teal)",
    tint: "#f0fdfa",
    strongTint: "#ccfbf1",
    icon: "shield-check",
    purpose: "Se kildekning, usikkerhet og verifikasjonsstatus"
  },
  export: {
    label: "Eksport",
    accent: "var(--evida-navy)",
    tint: "#f8fafc",
    strongTint: "#e2e8f0",
    icon: "download",
    purpose: "Eksporter kontrollert materiale"
  },
  draft: {
    label: "Utkast",
    accent: "var(--evida-purple)",
    tint: "#f5f3ff",
    strongTint: "#ede9fe",
    icon: "file-pen",
    purpose: "Lag arbeidsutkast fra kontrollert kildegrunnlag"
  },
  litigationSimulation: {
    label: "Rettssimulering",
    accent: "var(--evida-cyan)",
    tint: "#ecfeff",
    strongTint: "#cffafe",
    icon: "gavel",
    purpose: "Tren på spørsmål, motargumenter og prosessrisiko"
  }
};

export function workroomKeyForView(view: ViewKey): WorkroomKey {
  return view as WorkroomKey;
}

export function workroomStyle(workroom: WorkroomKey) {
  const theme = WORKROOM_THEME[workroom];
  return {
    "--workroom-accent": theme.accent,
    "--workroom-tint": theme.tint,
    "--workroom-strong-tint": theme.strongTint
  } as CSSProperties;
}
