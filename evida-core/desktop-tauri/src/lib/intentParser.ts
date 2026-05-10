import type { SuggestedAction } from "../types/chat";

export type UserQuestionIntent =
  | "case_content"
  | "processing_status"
  | "recommendation"
  | "app_help"
  | "legal_work_mode"
  | "settings_security"
  | "unknown";

const ordinalMap: Record<string, number> = {
  forste: 1,
  "første": 1,
  "fÃ¸rste": 1,
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
    .replace(/Ã¦/g, "ae")
    .replace(/Ã¸/g, "o")
    .replace(/Ã¥/g, "a")
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
  "eta"
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
  "viktigste punkter"
];

export function classifyUserQuestion(input: string): UserQuestionIntent {
  const q = normalizeIntentText(input);
  if (!q) {
    return "unknown";
  }
  if (recommendationTerms.some((term) => q.includes(term))) {
    return "recommendation";
  }
  if (settingsSecurityTerms.some((term) => q.includes(term))) {
    return "settings_security";
  }
  if (processingStatusTerms.some((term) => q.includes(term))) {
    return "processing_status";
  }
  if (legalWorkModeTerms.some((term) => q.includes(term))) {
    return "legal_work_mode";
  }
  if (caseContentTerms.some((term) => q.includes(term))) {
    return "case_content";
  }
  return "unknown";
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
