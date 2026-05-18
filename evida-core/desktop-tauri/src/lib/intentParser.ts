import type { SuggestedAction } from "../types/chat";

export type UserQuestionIntent =
  | "case_content"
  | "process_status"
  | "recommendation"
  | "source_question"
  | "risk_assessment"
  | "timeline"
  | "contradiction"
  | "evidence"
  | "app_help"
  | "legal_work_mode"
  | "settings_security"
  | "general";

const ordinalMap: Record<string, number> = {
  forste: 1,
  "første": 1,
  andre: 2,
  tredje: 3,
  fjerde: 4
};

function normalizeIntentText(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .replace(/\s+/g, " ");
}

const recommendationTerms = [
  "hva anbefaler du",
  "hva bor jeg gjore",
  "hva burde jeg gjore",
  "neste steg",
  "hvor bor jeg begynne",
  "hva er tryggeste",
  "hva kan jeg gjore na",
  "hva burde jeg prioritere",
  "hva anbefaler du meg a gjore",
  "hva gjor jeg na",
  "hva bor prioriteres"
];

const processingStatusTerms = [
  "status",
  "behandling",
  "ferdig",
  "gjenstar",
  "hvor langt",
  "kildedekning",
  "mangler sider",
  "eta",
  "jobber evida",
  "gjenstar det"
];

const sourceQuestionTerms = [
  "hva bygger du dette pa",
  "hva bygger du pa",
  "hvilke kilder",
  "hvor finner jeg dette",
  "kildegrunnlag",
  "vis kilder"
];

const riskAssessmentTerms = [
  "er denne saken sterk",
  "sterk nok",
  "svakheten",
  "risiko",
  "hva er svakheten",
  "hvor sterk"
];

const timelineTerms = [
  "tidslinje",
  "kronologi",
  "hendelsesforlop",
  "stemmer tidslinjen",
  "datoene"
];

const contradictionTerms = [
  "motstrid",
  "avvik",
  "motsier",
  "forklaring og dokumentasjon",
  "stemmer ikke"
];

const evidenceTerms = [
  "bevis",
  "finn bevis",
  "hva dokumenterer",
  "bevismatrise"
];

const settingsSecurityTerms = [
  "sikkerhet",
  "lokalmodus",
  "ekstern ai",
  "kryptering",
  "personvern",
  "innstillinger"
];

const legalWorkModeTerms = [
  "kronologi",
  "bevis",
  "motstrid",
  "risiko",
  "utkast",
  "rettssimulering",
  "kvalitet"
];

const caseContentTerms = [
  "hva handler",
  "oppsummer",
  "kort fortalt",
  "forklar saken",
  "hovedspor",
  "viktigste punkter",
  "hvem hadde",
  "faktisk kontroll",
  "hva skjedde",
  "hvilke transaksjoner",
  "transaksjoner gar igjen"
];

export function classifyUserQuestion(input: string): UserQuestionIntent {
  const q = normalizeIntentText(input);
  if (!q) {
    return "general";
  }
  if (recommendationTerms.some((term) => q.includes(term))) {
    return "recommendation";
  }
  if (settingsSecurityTerms.some((term) => q.includes(term))) {
    return "settings_security";
  }
  if (processingStatusTerms.some((term) => q.includes(term))) {
    return "process_status";
  }
  if (sourceQuestionTerms.some((term) => q.includes(term))) {
    return "source_question";
  }
  if (riskAssessmentTerms.some((term) => q.includes(term))) {
    return "risk_assessment";
  }
  if (timelineTerms.some((term) => q.includes(term))) {
    return "timeline";
  }
  if (contradictionTerms.some((term) => q.includes(term))) {
    return "contradiction";
  }
  if (evidenceTerms.some((term) => q.includes(term))) {
    return "evidence";
  }
  if (legalWorkModeTerms.some((term) => q.includes(term))) {
    return "legal_work_mode";
  }
  if (caseContentTerms.some((term) => q.includes(term))) {
    return "case_content";
  }
  return "general";
}

export function resolveSuggestedAction(input: string, actions: SuggestedAction[]) {
  const normalized = normalizeIntentText(input);
  const directNumber = normalized.match(/\b([1-4])\b/)?.[1];
  const ordinal = Object.entries(ordinalMap).find(([word]) => normalized.includes(word))?.[1];
  const index = directNumber ? Number(directNumber) : ordinal;
  if (!index) {
    return undefined;
  }
  return actions.find((action) => action.index === index);
}
