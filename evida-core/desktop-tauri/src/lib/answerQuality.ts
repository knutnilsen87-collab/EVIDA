import type { UserQuestionIntent } from "./intentParser";

export type AnswerConfidence = "low" | "medium" | "high";

export type StructuredAnswerQuality = {
  answered_user_question: boolean;
  question_type: UserQuestionIntent;
  confidence: AnswerConfidence;
};

export type StructuredSaksromAnswer = {
  direct_answer: string;
  partner_assessment: string;
  reasoning_points: string[];
  uncertainty: string;
  next_best_step: string;
  suggested_followups: string[];
  source_ids: string[];
  answer_quality: StructuredAnswerQuality;
};

export type AnswerValidationInput = {
  answer: StructuredSaksromAnswer;
  allowedSourceIds: string[];
  weakSourceBasis: boolean;
};

export type AnswerValidationResult = {
  ok: boolean;
  reasons: string[];
};

export const BLOCKED_MAIN_ANSWER_PATTERNS = [
  /ØKOKRIM\s*[-–]\s*EVIDA STRESSTEST/i,
  /EVIDA STRESSTEST/i,
  /CASEPILOT Mega Test/i,
  /Bates\s+OKO-/i,
  /Dokument-ID:/i,
  /Dokumenttype:/i,
  /løpenummer/i,
  /Regnskapsutdrag\s*\|\s*Bates/i,
  /\.pdf\b/i,
  /\bFormat:\s*timestamp\b/i,
  /\b(APPROVE_BATCH|VIEW_ACCOUNT|EXPORT_CSV|LOGIN|VPN)\b/i,
  /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
  /\b\d{1,3}(?:\.\d{1,3}){3}\b/
];

export function mainAnswerHasBlockedMetadata(value: string) {
  return BLOCKED_MAIN_ANSWER_PATTERNS.some((pattern) => pattern.test(value));
}

export function normalizeMainAnswerText(value: string) {
  return value
    .split(/\r\n/)
    .map((line) => line.trim())
    .filter((line) => line && !mainAnswerHasBlockedMetadata(line))
    .join("\n")
    .replace(/^ØKOKRIM\s*[-–]\s*/i, "")
    .replace(/^EVIDA\s+STRESSTEST\s*/i, "")
    .replace(/\s*\|\s*Bates\b.*$/i, "")
    .replace(/\s*\|\s*Dokumenttype\b.*$/i, "")
    .replace(/\s*\|\s*Dokument-ID\b.*$/i, "")
    .trim();
}

export function validateStructuredAnswer(input: AnswerValidationInput): AnswerValidationResult {
  const reasons: string[] = [];
  const answer = input.answer;
  const mainText = [
    answer.direct_answer,
    answer.partner_assessment,
    ...answer.reasoning_points,
    answer.uncertainty,
    answer.next_best_step,
    ...answer.suggested_followups
  ].join("\n");

  if (!answer.direct_answer.trim()) {
    reasons.push("DIRECT_ANSWER_EMPTY");
  }
  if ((answer.direct_answer || "").trim().length < 30) {
    reasons.push("DIRECT_ANSWER_TOO_SHORT");
  }
  if (!answer.answer_quality.answered_user_question) {
    reasons.push("QUESTION_NOT_ANSWERED");
  }
  if (mainAnswerHasBlockedMetadata(mainText)) {
    reasons.push("MAIN_ANSWER_CONTAINS_SOURCE_METADATA");
  }
  if (input.weakSourceBasis && !answer.uncertainty.trim()) {
    reasons.push("UNCERTAINTY_REQUIRED_FOR_WEAK_BASIS");
  }

  const allowed = new Set(input.allowedSourceIds);
  for (const sourceId of answer.source_ids || []) {
    if (!allowed.has(sourceId)) {
      reasons.push(`INVALID_SOURCE_ID:${sourceId}`);
    }
  }

  return {
    ok: reasons.length === 0,
    reasons
  };
}

export function structuredToDisplayAnswer(answer: StructuredSaksromAnswer) {
  const reasoning = answer.reasoning_points.slice(0, 2).join(" ");
  const assessment = answer.partner_assessment || "Jeg har ikke nok grunnlag til en sterkere vurdering ennå.";
  const uncertainty = answer.uncertainty || "Dette må kontrolleres mot kildene før bruk.";
  const nextStep = answer.next_best_step || "Åpne kontrollstatus og se hvilke kilder som er klare.";
  const followups = answer.suggested_followups.slice(0, 2);

  return [
    answer.direct_answer,
    reasoning ? `${assessment} ${reasoning}` : assessment,
    `Forbeholdet mitt er dette: ${uncertainty}`,
    `Neste steg bør være: ${nextStep}${followups.length > 0 ? ` Deretter ville jeg undersøkt ${followups.join(" og ").toLowerCase()}.` : ""}`
  ].filter(Boolean).join("\n\n");
}

export function createSafeFallbackStructuredAnswer(args: {
  intent: UserQuestionIntent;
  allowedSourceIds: string[];
  nextBestStep: string;
}): StructuredSaksromAnswer {
  return {
    direct_answer:
      "Jeg klarte ikke å lage et godt nok saksbasert svar på dette spørsmålet akkurat nå.",
    partner_assessment:
      "Kildegrunnlaget som ble hentet ser ut til å være for preget av dokumentmetadata eller mangler tydelig saksinnhold.",
    reasoning_points: [
      "Jeg viser derfor ikke rått eller uvalidert AI-svar.",
      "Svargrunnlaget bør kontrolleres før vi prøver samme spørsmål igjen."
    ],
    uncertainty:
      "Høy. Svaret er stoppet av kvalitetskontroll, ikke av en juridisk vurdering.",
    next_best_step:
      args.nextBestStep || "Åpne Kontrollstatus, se hvilke kilder som faktisk er lesbare, og oppdater kildegrunnlaget.",
    suggested_followups: [
      "Se behandlingsstatus",
      "Hvilke kilder er klare",
      "Hva bør kontrolleres først"
    ],
    source_ids: args.allowedSourceIds.slice(0, 3),
    answer_quality: {
      answered_user_question: false,
      question_type: args.intent,
      confidence: "low"
    }
  };
}
