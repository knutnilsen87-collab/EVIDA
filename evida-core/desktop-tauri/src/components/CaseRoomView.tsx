import { useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import type { CaseAiMessageDto, CaseSummary, DocumentSummary, ImportItemStatus, SourceObjectSummary } from "../types";
import { askCaseAi, listCaseAiMessages, recordCaseAiExchange } from "../lib/api";
import type { ReadinessResult } from "../features/readiness/caseReadiness";
import {
  createDefaultSuggestedActions,
  resolveSuggestedActionReply
} from "../features/adaptiveSaksrom/suggestedActions";
import type { CollaborationMode, SuggestedAction } from "../features/adaptiveSaksrom/suggestedActions";
import {
  COLLABORATION_MODE_LABELS,
  createEmptyCaseConversationMemory,
  inferCollaborationModeFromText,
  readCaseConversationMemory,
  updateCaseConversationMemory
} from "../features/adaptiveSaksrom/conversationMemory";
import {
  DEFAULT_WORKSTYLE_PREFERENCES,
  readWorkstylePreferences,
  writeWorkstylePreferences
} from "../features/adaptiveSaksrom/workstyle";
import type { WorkstylePreferences } from "../features/adaptiveSaksrom/workstyle";
import { SAKSROM_WORK_STATES } from "../features/adaptiveSaksrom/workStates";
import {
  processingStageLabel,
  processingStageProgress,
  processingStepViews
} from "../types/processing";
import type { DocumentProcessingStage, ProcessingActivityState } from "../types/processing";
import { calculatePageProgress } from "../lib/processing";
import { classifyUserQuestion } from "../lib/intentParser";
import type { UserQuestionIntent } from "../lib/intentParser";
import {
  createSafeFallbackStructuredAnswer,
  mainAnswerHasBlockedMetadata,
  normalizeMainAnswerText,
  structuredToDisplayAnswer,
  validateStructuredAnswer
} from "../lib/answerQuality";
import { AssistantWorkState } from "./AssistantWorkState";

type LegacyImportStage = "selected" | "validating" | "hashing" | "extracting" | "chunking" | "ready" | "needs_attention";

interface CaseRoomViewProps {
  selectedCase?: CaseSummary;
  documents: DocumentSummary[];
  sources: SourceObjectSummary[];
  sourcesById: Map<string, SourceObjectSummary>;
  importQueue: CaseRoomImportItem[];
  isImporting: boolean;
  importNow: number;
  totalPageCount: number;
  processedPageCount: number;
  sourcePageCount: number;
  missingSourcePageCount: number;
  hasActiveProcessing: boolean;
  automaticTextRecognitionAvailable: boolean;
  pendingOcrPages: number;
  coverage: number;
  deviations: string[];
  readiness: ReadinessResult;
  preliminaryBanner?: string;
  nextActionTitle: string;
  systemStatus: CaseRoomSystemStatus;
  onOpenSource: (sourceId: string) => void;
  onOpenControl: () => void;
  onOpenSimulation: () => void;
  onRunCommand: (input: string) => Promise<string>;
  onChooseDocuments: () => void;
  onChooseFolder: () => void;
  onImportPaths: (paths: string[]) => void;
  onSaveCaseName: (name: string) => Promise<void>;
}

interface CaseRoomImportItem {
  path: string;
  name: string;
  status: DocumentProcessingStage | LegacyImportStage | ImportItemStatus;
  detail: string;
  pages?: number;
  pagesProcessed?: number;
  pagesTotal?: number;
  sources?: number;
  startedAt?: number;
}

interface CaseRoomSystemStatus {
  totalDocuments: number;
  readyDocuments: number;
  attentionDocuments: number;
  failedDocuments: number;
  processingDocuments: number;
  remainingDocuments: number;
  sourceCoveragePercent: number;
  ocrCoveragePercent?: number;
  pendingOcrPages: number;
  isImporting: boolean;
  currentPhaseLabel: string;
  etaLabel: string;
  nextActionTitle: string;
  saksromScope: "none" | "controlled_sources_only" | "full_case_sources";
  excludedDocuments: number;
}

interface CaseAnswer {
  answer: string;
  sourceIds: string[];
  validatedSources: Array<{
    sourceId: string;
    documentId: string;
    pageNumber?: number;
    validationStatus: string;
  }>;
  answerStrength: {
    level: "Lav" | "Middels" | "Høy";
    reason: string;
  };
  uncertainty: string;
  missing: string;
  nextStep: string;
  suggestedActions?: SuggestedAction[];
}

function toProcessingStage(stage: DocumentProcessingStage | LegacyImportStage | ImportItemStatus | undefined): DocumentProcessingStage | undefined {
  switch (stage) {
    case "selected":
      return "queued";
    case "validating":
      return "reading_file";
    case "hashing":
      return "counting_pages";
    case "extracting":
      return "extracting_text";
    case "chunking":
      return "finding_source_points";
    case "ready":
    case "partial":
    case "duplicate":
      return "completed";
    case "ocr_required":
    case "unsupported":
    case "cancelled":
    case "ocr_running":
    case "indexed":
      return "failed";
    case "needs_attention":
      return "failed";
    default:
      return stage;
  }
}

interface CaseSummarySections {
  short: string;
  keyPoints: string[];
  actors: string[];
  tracks: string[];
  uncertainty: string[];
  nextSteps: string[];
}

function firstSentence(value: string) {
  const sentence = value.split(/[.!?]\s/)[0] || value;
  return sentence.length > 150 ? `${sentence.slice(0, 147)}...` : sentence;
}

function cleanSummaryPoint(value: string) {
  const sentence = firstSentence(value).replace(/\s+/g, " ").trim();
  const topic = sentence.match(/\bTema:\s*([^|.]+)/i)?.[1]?.trim();
  let clean = topic || sentence;

  clean = clean
    .replace(/^ØKOKRIM\s*[-–]\s*/i, "")
    .replace(/^EVIDA\s+STRESSTEST\s*/i, "")
    .replace(/^STOR\s+KOMPLEKS\s+STRAFFESAK\s*\([^)]*\)\s*Sak nr:\s*[^|.]+/i, "")
    .replace(/^STOR\s+KOMPLEKS\s+STRAFFESAK[^|.]*/i, "")
    .replace(/\s*\|\s*Bates\b.*$/i, "")
    .replace(/\s*\|\s*Dokumenttype\b.*$/i, "")
    .replace(/\s*\|\s*Dokument-ID\b.*$/i, "")
    .replace(/\s*\|\s*Kilde-ID\b.*$/i, "")
    .replace(/^[-–|:\s]+/, "")
    .trim();

  if (!clean) {
    return "Kilden inneholder saksinformasjon som bør leses i originalutdraget.";
  }

  if (clean.length < 18) {
    return `${clean} inngår i kildegrunnlaget.`;
  }

  return clean.length > 150 ? `${clean.slice(0, 147)}...` : clean;
}

function removeSummaryMetadataPrefix(value: string) {
  let clean = value.replace(/\s+/g, " ").trim();
  const topic = clean.match(/\bTema:\s*([^|.]+)/i)?.[1]?.trim();
  if (topic) {
    clean = topic;
  }

  clean = clean
    .replace(/^ØKOKRIM\s*[-–]\s*/i, "")
    .replace(/^OKOKRIM\s*[-–]\s*/i, "")
    .replace(/^EVIDA\s+STRESSTEST\s*/i, "")
    .replace(/^STOR\s+KOMPLEKS\s+STRAFFESAK\s*\([^)]*\)\s*Sak nr:\s*[^|.]+/i, "")
    .replace(/^STOR\s+KOMPLEKS\s+STRAFFESAK[^|.]*/i, "")
    .replace(/^\(?\d+\+?\s*SIDER\)?\s*Sak nr:\s*[^|.]+/i, "")
    .replace(/\s*\|\s*Bates\b.*$/i, "")
    .replace(/\s*\|\s*Dokumenttype\b.*$/i, "")
    .replace(/\s*\|\s*Dokument-ID\b.*$/i, "")
    .replace(/\s*\|\s*Kilde-ID\b.*$/i, "")
    .replace(/^[-–|:\s]+/, "")
    .trim();

  return clean.length > 150 ? `${clean.slice(0, 147)}...` : clean;
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3);
}

function scoreSource(questionTerms: string[], source: SourceObjectSummary) {
  const text = source.text_excerpt.toLowerCase();
  return questionTerms.reduce((score, term) => score + (text.includes(term) ? 1 : 0), 0);
}

function unique(values: string[], limit: number) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).slice(0, limit);
}

function isNoisyActorLabel(value: string) {
  const normalized = value.toLowerCase().trim();
  return [
    "sak",
    "tema",
    "grovt",
    "formål",
    "syntetisk",
    "tester",
    "dokument",
    "side",
    "evida",
    "saksrom",
    "bates",
    "økokrim",
    "okokrim"
  ].includes(normalized) || /^evida\s+stresstest/i.test(value);
}

function extractActorsFromSources(sources: SourceObjectSummary[]) {
  const text = sources.map((source) => source.text_excerpt).join(" ");
  const matches = text.match(/\b[A-ZÆØÅ][a-zæøå]{2,}(?:\s+[A-ZÆØÅ][a-zæøå]{2,}){0,3}\b/g) || [];
  return unique(
    matches.filter((value) => !["Evida", "Saksrom", "Dokument", "Side"].includes(value)),
    6
  );
}

function inferTracksFromSources(sources: SourceObjectSummary[]) {
  const text = sources.map((source) => source.text_excerpt.toLowerCase()).join(" ");
  const tracks: Array<[string, string[]]> = [
    ["Økonomiske transaksjoner", ["transaksjon", "betaling", "konto", "bank", "beløp", "faktura"]],
    ["Kommunikasjon og beslutninger", ["epost", "e-post", "melding", "brev", "referat", "samtale"]],
    ["Regnskap og dokumentasjon", ["regnskap", "bilag", "bokføring", "årsregnskap", "rapport"]],
    ["Selskapsstruktur og roller", ["selskap", "styre", "daglig leder", "aksjonær", "rolle"]],
    ["Datoer og hendelsesforløp", ["dato", "periode", "hendelse", "møte", "frist"]],
    ["Tekniske spor", ["logg", "ip", "system", "fil", "metadata"]]
  ];

  return unique(
    tracks
      .filter(([, terms]) => terms.some((term) => text.includes(term)))
      .map(([label]) => label),
    5
  );
}

function buildCaseSummarySections(
  selectedCase: CaseSummary | undefined,
  sources: SourceObjectSummary[],
  coverage: number,
  pendingOcrPages: number,
  deviations: string[]
): CaseSummarySections {
  const representativeSources = sources.slice(0, 7);
  const keyPoints = unique(
    representativeSources
      .map((source) => removeSummaryMetadataPrefix(cleanSummaryPoint(source.text_excerpt)))
      .filter((line) => line.length > 12),
    6
  );
  const actors = extractActorsFromSources(representativeSources).filter((actor) => !isNoisyActorLabel(actor));
  const tracks = inferTracksFromSources(sources);
  const hasCompleteBasis = coverage >= 95 && pendingOcrPages === 0 && deviations.length === 0;

  return {
    short:
      keyPoints.length > 0
        ? `Kort fortalt fremstår ${selectedCase?.name || "saken"} som en sak der de klare kildene særlig peker mot ${tracks[0]?.toLowerCase() || "et dokumentert faktum som må struktureres videre"}.`
        : `Kort fortalt er ${selectedCase?.name || "saken"} klar for første saksforståelse, men kildene må leses nærmere før Evida kan trekke tydelige hovedlinjer.`,
    keyPoints:
      keyPoints.length > 0
        ? keyPoints
        : ["Det finnes sporbare kilder, men ingen tydelige nøkkelpunkter er hentet ut ennå."],
    actors: actors.length > 0 ? actors : ["Ingen sentrale aktører er sikkert identifisert i den foreløpige lokale analysen."],
    tracks: tracks.length > 0 ? tracks : ["Faktumskartlegging", "Kronologi", "Bevisvurdering"],
    uncertainty: hasCompleteBasis
      ? ["Grunnlaget ser klart ut for foreløpig saksarbeid, men juridiske vurderinger må fortsatt kontrolleres manuelt."]
      : [
          pendingOcrPages > 0 ? "Noen sider trenger fortsatt tekstkontroll." : "",
          deviations.length > 0 ? "Det finnes avvik i kontrollgrunnlaget." : "",
          coverage < 95 ? "Ikke hele dokumentgrunnlaget er sikkert kildeklart." : ""
        ].filter(Boolean),
    nextSteps: ["Bygg kronologi", "Finn bevis", "Se etter motstrid", "Vurder risiko", "Hva bør jeg lese først?"]
  };
}

function formatAnswer(
  selected: SourceObjectSummary[],
  coverage: number,
  pendingOcrPages: number,
  deviations: string[],
  nextActionTitle: string
) {
  const answerSentences = selected.map((source) => removeSummaryMetadataPrefix(cleanSummaryPoint(source.text_excerpt)));
  const importantPoints = answerSentences.length > 0 ? answerSentences : ["Jeg finner ikke et tydelig kildepunkt ennå."];
  const needsCaution = coverage < 95 || pendingOcrPages > 0 || deviations.length > 0;

  return [
    "Kort svar",
    `Basert på kildene som er klare, er det viktigste jeg finner: ${importantPoints[0]}`,
    "",
    "Viktigste vurdering",
    ...importantPoints.slice(0, 4).map((point) => `- ${point}`),
    "",
    "Usikkerhet / mangler",
    needsCaution
      ? "- Svaret er foreløpig fordi dokumentgrunnlaget eller tekstkontrollen ikke er helt komplett."
      : "- Grunnlaget ser klart ut for foreløpig saksarbeid, men må kontrolleres faglig.",
    deviations.length > 0 ? `- Kontrollavvik: ${deviations.join(" ")}` : "- Ingen særskilte kontrollavvik vises i dette svaret.",
    "",
    "Neste anbefalte handling",
    `- ${nextActionTitle}`
  ].join("\n");
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function splitForReveal(answer: string) {
  const paragraphs = answer.split(/\n\s*\n/).filter(Boolean);
  if (paragraphs.length > 1) {
    return paragraphs.map((paragraph, index) => (index === 0 ? paragraph : `\n\n${paragraph}`));
  }
  return answer.match(/.{1,160}(?:\s|$)/g) || [answer];
}

function normalizeAssistantAnswer(answer: string) {
  return answer
    .replace(/^Sikker lokalmodus finner foreløpig dette i sakens sporbare kilder:\s*/i, "Basert på kildene som er klare: ")
    .replace(/^Sikker lokalmodus fant\s*/i, "Jeg fant ");
}

function isNearBottom(container: HTMLElement, threshold = 120) {
  return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
}

function isTemporaryCaseTitle(name?: string) {
  return /^Ny sak [–-] \d{4}-\d{2}-\d{2}$/.test(name || "");
}

function formatDuration(ms: number) {
  const seconds = Math.max(1, Math.round(ms / 1000));
  if (seconds < 60) {
    return `${seconds} sek`;
  }
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest > 0 ? `${minutes} min ${rest} sek` : `${minutes} min`;
}

function liveStageProgress(item: CaseRoomImportItem | undefined, nowMs: number) {
  const stage = toProcessingStage(item?.status);
  if (!stage) {
    return 0;
  }
  if (stage === "completed" || stage === "failed") {
    return 100;
  }

  const base = processingStageProgress(stage);
  const elapsed = item?.startedAt ? nowMs - item.startedAt : 0;
  const stageRanges: Partial<Record<DocumentProcessingStage, number>> = {
    queued: 9,
    reading_file: 9,
    counting_pages: 19,
    extracting_text: 19,
    finding_source_points: 14,
    building_case_basis: 14,
    checking_coverage: 9
  };
  const range = stageRanges[stage] || 0;
  const heartbeat = Math.min(range, Math.floor(elapsed / 2500));
  return Math.min(99, base + heartbeat);
}

function importEta(item: CaseRoomImportItem | undefined, nowMs: number) {
  if (!item) {
    return "Beregnes";
  }
  const elapsed = item.startedAt ? nowMs - item.startedAt : 0;
  if (["completed", "failed"].includes(item.status)) {
    return item.startedAt ? `Brukte ${formatDuration(elapsed)}` : "Ferdig";
  }
  if (item.status === "extracting_text") {
    if (elapsed < 30_000) {
      return `Omtrent 1-3 min igjen · gått ${formatDuration(elapsed)}`;
    }
    if (elapsed < 120_000) {
      return `Omtrent 1-2 min igjen · gått ${formatDuration(elapsed)}`;
    }
    return `Tar litt tid med stort dokument · gått ${formatDuration(elapsed)}`;
  }
  if (item.status === "finding_source_points" || item.status === "building_case_basis" || item.status === "checking_coverage") {
    return `Omtrent under 1 min igjen · gått ${formatDuration(elapsed)}`;
  }
  return elapsed > 2000 ? `Omtrent under 1 min igjen · gått ${formatDuration(elapsed)}` : "Starter straks";
}

function intakeStepLabel(item: CaseRoomImportItem | undefined) {
  return processingStageLabel(toProcessingStage(item?.status));

  /*
  if (!item) {
    return "Venter";
  }
  switch (item.status) {
    case "selected":
      return "Klargjør dokumenter";
    case "validating":
      return "Sjekker filer";
    case "hashing":
      return "Sikrer dokumentreferanser";
    case "extracting":
      return "Leser tekst og teller sider";
    case "chunking":
      return "Lager sporbare kilder";
    case "ready":
      return "Klar";
    case "needs_attention":
      return "Trenger tekstkontroll";
    case "failed":
      return "Feilet";
  }
  */
}

function importLiveProgressPercent(item: CaseRoomImportItem | undefined, nowMs: number) {
  void nowMs;
  return liveStageProgress(item, nowMs);

  /*
  if (!item) {
    return 0;
  }
  if (item.status === "ready" || item.status === "needs_attention" || item.status === "failed") {
    return 100;
  }

  const elapsed = item.startedAt ? nowMs - item.startedAt : 0;
  const pulse = Math.min(18, Math.floor(elapsed / 1800));
  switch (item.status) {
    case "selected":
      return Math.min(14, 6 + pulse);
    case "validating":
      return Math.min(28, 16 + pulse);
    case "hashing":
      return Math.min(42, 30 + pulse);
    case "extracting":
      return Math.min(78, 45 + pulse);
    case "chunking":
      return Math.min(94, 80 + Math.floor(elapsed / 1200));
    default:
      return 0;
  }
  */
}

function pageCountForImportItem(item: CaseRoomImportItem) {
  return item.pagesTotal || item.pages || 0;
}

function activeIntakeWorkState(stage: DocumentProcessingStage | LegacyImportStage | ImportItemStatus | undefined) {
  const stepViews = processingStepViews(toProcessingStage(stage));
  return {
    states: stepViews.map((step) => step.label),
    activeIndex: stepViews.findIndex((step) => step.state === "active" || step.state === "failed"),
    stepViews
  };

  /*
  const states = [
    "Leser fil",
    "Teller sider",
    "Henter tekst",
    "Finner kildepunkter",
    "Bygger saksgrunnlag"
  ];
  return {
    states,
    activeIndex: 0
  };
  */
}

function resolveProcessingActivityState(args: {
  hasDocuments: boolean;
  isImporting: boolean;
  hasActiveProcessing: boolean;
  hasQueuedItems: boolean;
  hasFailedItems: boolean;
  pagesMissingSources: number;
  automaticTextRecognitionAvailable: boolean;
}): ProcessingActivityState {
  if (args.hasFailedItems) {
    return "failed";
  }
  if (args.isImporting || args.hasActiveProcessing) {
    return "active";
  }
  if (args.hasQueuedItems) {
    return "queued";
  }
  if (!args.hasDocuments) {
    return "queued";
  }
  if (args.pagesMissingSources <= 0) {
    return "completed";
  }
  if (!args.automaticTextRecognitionAvailable) {
    return "unavailable";
  }
  return "completed_with_gaps";
}

function processingActivityLabel(state: ProcessingActivityState) {
  switch (state) {
    case "active":
      return "Evida behandler fortsatt dokumentene.";
    case "queued":
      return "Dokumentene venter på behandling.";
    case "waiting_for_worker":
      return "Venter på dokumentmotor.";
    case "paused":
      return "Behandlingen er satt på pause.";
    case "completed":
      return "Alle sider er klare.";
    case "completed_with_gaps":
      return "Behandlingen er fullført, men noen sider kunne ikke gjøres om til sporbare kilder.";
    case "failed":
      return "Behandlingen kunne ikke fullføres automatisk.";
    case "unavailable":
      return "Automatisk teksthenting er ikke tilgjengelig i denne versjonen.";
  }
}

function processingActivityDetail(state: ProcessingActivityState, pagesMissingSources: number, pagesWithSources: number) {
  if (state === "active" && pagesMissingSources > 0) {
    return `Evida behandler fortsatt ${pagesMissingSources} sider.`;
  }
  if (state === "unavailable" && pagesMissingSources > 0) {
    return `${pagesMissingSources} sider mangler tekst. Evida bruker de ${pagesWithSources} sidene som er klare og markerer resten som manglende grunnlag.`;
  }
  if (state === "completed_with_gaps" && pagesMissingSources > 0) {
    return `${pagesMissingSources} sider mangler fortsatt tekst eller sporbare kilder.`;
  }
  return "";
}

function buildRecommendationAnswer(args: {
  selectedCase?: CaseSummary;
  sources: SourceObjectSummary[];
  readiness: ReadinessResult;
  sourceCoveragePercent: number;
  pagesMissingSources: number;
  pagesRemainingProcessing: number;
  processingActivityState: ProcessingActivityState;
  etaLabel: string;
  nextActionTitle: string;
}): CaseAnswer {
  const coverage = Math.max(0, Math.min(100, Math.round(args.sourceCoveragePercent)));
  const hasMissingSources = args.pagesMissingSources > 0;
  const isWorking = args.processingActivityState === "active";

  let directRecommendation = "Start med å legge til dokumenter, så kan Evida bygge kildegrunnlaget.";
  let safeLevel = "Ikke klar for saksarbeid";
  let orderedSteps = [
    "Legg til dokumenter i Saksrom.",
    "La Evida lese dokumentene og lage sporbare kilder.",
    "Vent med juridisk analyse til kildedekningen er høy nok."
  ];
  let waitWith = [
    "Saksoppsummering.",
    "Kronologi, bevismatrise, risiko og utkast.",
    "Endelig kontroll eller rettssimulering."
  ];

  if (coverage < 50) {
    directRecommendation = isWorking
      ? "Jeg anbefaler at du følger behandlingsstatus nå og venter med juridisk analyse til flere sider er gjort om til sporbare kilder."
      : "Jeg anbefaler at du sjekker behandlingsstatus før du bruker Saksrom til juridisk analyse.";
    safeLevel = "Behandlingsstatus og importkontroll";
    orderedSteps = [
      "Følg behandlingsstatus for dokumentene.",
      "Vent til kildedekningen passerer minst 50 % før du bruker Saksrom til foreløpig orientering.",
      "Når dekningen nærmer seg 80 %, kan du be om foreløpig oversikt."
    ];
    waitWith = [
      "Juridiske vurderinger.",
      "Kronologi, bevismatrise og risikovurdering.",
      "Utkast, eksport og rettssimulering."
    ];
  } else if (coverage < 80) {
    directRecommendation = "Jeg anbefaler at du bruker saken kun til foreløpig orientering, og lar behandlingen bli mer komplett før du lager arbeidsprodukter.";
    safeLevel = "Foreløpig orientering";
    orderedSteps = [
      "Se hva som mangler i behandlingsstatus.",
      "Bruk Saksrom til å orientere deg i det som allerede er kildeklart.",
      "Vent med strukturerte juridiske arbeidsprodukter til dekningen er minst 80 %."
    ];
    waitWith = [
      "Utkast og endelig kontroll.",
      "Rettssimulering.",
      "Konklusjoner som forutsetter komplett dokumentgrunnlag."
    ];
  } else if (coverage < 95) {
    directRecommendation = "Jeg anbefaler at du bruker Saksrom til foreløpig oversikt nå, men markerer alt arbeid som foreløpig.";
    safeLevel = "Foreløpig saksarbeid";
    orderedSteps = [
      "Les den foreløpige saksoppsummeringen.",
      "Bygg kronologi hvis du samtidig noterer at noe dokumentgrunnlag mangler.",
      "Se etter motstrid og bevis, men ikke lås vurderingene før dekningen er høyere."
    ];
    waitWith = [
      "Endelige utkast.",
      "Eksport uten kontroll.",
      "Rettssimulering og konklusjoner."
    ];
  } else if (coverage < 100 || hasMissingSources) {
    directRecommendation = `Jeg anbefaler at du bruker Saksrom til foreløpig saksarbeid nå, og først sjekker hvorfor ${args.pagesMissingSources} sider fortsatt ikke er med i kildegrunnlaget.`;
    safeLevel = "Foreløpig saksarbeid";
    orderedSteps = [
      `Se behandlingsstatus for de ${args.pagesMissingSources} sidene som mangler kildegrunnlag.`,
      "Fortsett i Saksrom for foreløpig oversikt.",
      "Bygg kronologi når du er klar over at noen sider mangler.",
      "Vent med utkast, endelig kontroll og rettssimulering til sidene er avklart."
    ];
    waitWith = [
      "Endelige utkast.",
      "Eksport og kvalitetssikring som forutsetter komplett grunnlag.",
      "Rettssimulering uten tydelig forbehold."
    ];
  } else {
    directRecommendation = "Jeg anbefaler at du bygger kronologi først, deretter bevismatrise, motstrid og risiko før du går videre til utkast og kvalitet.";
    safeLevel = "Kontrollert saksarbeid";
    orderedSteps = [
      "Bygg kronologi.",
      "Bygg bevismatrise.",
      "Se etter motstrid.",
      "Vurder risiko.",
      "Gå videre til utkast og kvalitetssjekk."
    ];
    waitWith = [
      "Ingenting bør brukes uten menneskelig juridisk kontroll.",
      "Ikke eksporter eller send videre uten kildekontroll."
    ];
  }

  const whyLines = [
    `Readiness: ${args.readiness.label}.`,
    `Kildedekning: ${coverage} %.`,
    hasMissingSources ? `${args.pagesMissingSources} sider mangler fortsatt sporbare kilder.` : "Ingen kjente sider mangler sporbare kilder.",
    isWorking ? `Behandling: aktiv. Estimert tid: ${args.etaLabel}.` : `Behandling: ${processingActivityLabel(args.processingActivityState)}`
  ];

  const selectedSources = args.sources.slice(0, 3);
  return {
    answer: [
      "Anbefalt neste steg",
      "",
      "Kort svar",
      directRecommendation,
      "",
      "Hvorfor",
      ...whyLines.map((line) => `- ${line}`),
      "",
      "Anbefalt rekkefølge",
      ...orderedSteps.map((step, index) => `${index + 1}. ${step}`),
      "",
      "Hva du bør vente med",
      ...waitWith.map((step) => `- ${step}`),
      "",
      "Status nå",
      `Kildedekning: ${coverage} %`,
      `Sider som gjenstår: ${args.pagesMissingSources}`,
      `Behandling: ${processingActivityLabel(args.processingActivityState)}`,
      `Trygt arbeidsnivå: ${safeLevel}`,
      `Anbefalt neste steg: ${orderedSteps[0] || args.nextActionTitle}`
    ].join("\n"),
    sourceIds: selectedSources.map((source) => source.id),
    validatedSources: selectedSources.map((source) => ({
      sourceId: source.id,
      documentId: source.document_id,
      pageNumber: source.page_start,
      validationStatus: "LOCAL"
    })),
    answerStrength: {
      level: coverage >= 95 ? "Middels" : "Lav",
      reason: "Anbefalingen bygger på readiness, kildedekning, behandlingsstatus og tilgjengelige arbeidsmoduser."
    },
    uncertainty: hasMissingSources
      ? "Middels. Noe dokumentgrunnlag mangler fortsatt sporbare kilder."
      : "Lav til middels. Anbefalingen må fortsatt vurderes av bruker.",
    missing: hasMissingSources ? `${args.pagesMissingSources} sider mangler sporbare kilder.` : "Menneskelig juridisk kontroll.",
    nextStep: orderedSteps[0] || args.nextActionTitle
  };
}

function buildAnswer(
  question: string,
  sources: SourceObjectSummary[],
  coverage: number,
  deviations: string[],
  pendingOcrPages: number,
  nextActionTitle: string
): CaseAnswer {
  if (sources.length === 0) {
    return {
      answer: [
        "Kort svar",
        "Jeg finner ingen sporbare kilder å svare fra ennå.",
        "",
        "Viktigste vurdering",
        "- Saksrom trenger minst ett kildeutdrag før svaret kan bli etterprøvbart.",
        "",
        "Usikkerhet / mangler",
        "- Kildegrunnlag mangler.",
        "",
        "Neste anbefalte handling",
        "- Importer dokumenter eller oppdater kildene."
      ].join("\n"),
      sourceIds: [],
      validatedSources: [],
      answerStrength: {
        level: "Lav",
        reason: "Svaret bygger på 0 kilder."
      },
      uncertainty: "Høy. Saken mangler kildegrunnlag.",
      missing: "Importer dokumenter eller oppdater kildene.",
      nextStep: "Kontroller dokumentgrunnlag."
    };
  }

  const terms = tokenize(question);
  const ranked = sources
    .map((source) => ({ source, score: scoreSource(terms, source) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
  const selected = ranked.length > 0 ? ranked.map((item) => item.source) : sources.slice(0, 3);

  return {
    answer: formatAnswer(selected, coverage, pendingOcrPages, deviations, nextActionTitle),
    sourceIds: selected.map((source) => source.id),
    validatedSources: selected.map((source) => ({
      sourceId: source.id,
      documentId: source.document_id,
      pageNumber: source.page_start,
      validationStatus: "LOCAL"
    })),
    answerStrength: {
      level: selected.length >= 4 && coverage >= 80 && pendingOcrPages === 0 ? "Høy" : selected.length >= 2 ? "Middels" : "Lav",
      reason: `Svaret bygger på ${selected.length} lokale kilder. Ekstern AI er av.`
    },
    uncertainty:
      coverage < 80 || pendingOcrPages > 0
        ? "Middels til høy. Dokumentdekning eller tekst fra skannede sider er ikke komplett."
        : "Middels. Svaret er kildebasert, men må vurderes faglig.",
    missing: deviations.length > 0 ? deviations.join(" ") : "Juridisk vurdering, full kontekst og manuell godkjenning.",
    nextStep: nextActionTitle
  };
}

function safeFallbackCaseAnswer(args: {
  intent: UserQuestionIntent;
  sourceIds: string[];
  nextActionTitle: string;
}): CaseAnswer {
  const structured = createSafeFallbackStructuredAnswer({
    intent: args.intent,
    allowedSourceIds: args.sourceIds,
    nextBestStep: args.nextActionTitle
  });
  return {
    answer: structuredToDisplayAnswer(structured),
    sourceIds: structured.source_ids,
    validatedSources: [],
    answerStrength: {
      level: "Lav",
      reason: "Svaret ble stoppet av kvalitetskontroll og erstattet med trygg fallback."
    },
    uncertainty: structured.uncertainty,
    missing: structured.partner_assessment,
    nextStep: structured.next_best_step
  };
}

function qualityGateCaseAnswer(
  result: CaseAnswer,
  args: {
    intent: UserQuestionIntent;
    allowedSourceIds: string[];
    nextActionTitle: string;
    weakSourceBasis?: boolean;
  }
): CaseAnswer {
  const cleanAnswer = normalizeMainAnswerText(normalizeAssistantAnswer(result.answer));
  const sourceIds = result.sourceIds.filter((sourceId) => args.allowedSourceIds.includes(sourceId));
  const hasInvalidSourceIds = result.sourceIds.some((sourceId) => !args.allowedSourceIds.includes(sourceId));
  const structuredValidation = validateStructuredAnswer({
    answer: {
      direct_answer: cleanAnswer,
      partner_assessment: result.answerStrength.reason,
      reasoning_points: [],
      uncertainty: result.uncertainty,
      next_best_step: result.nextStep,
      suggested_followups: [],
      source_ids: sourceIds,
      answer_quality: {
        answered_user_question: true,
        question_type: args.intent,
        confidence: result.answerStrength.level === "Høy" ? "high" : result.answerStrength.level === "Middels" ? "medium" : "low"
      }
    },
    allowedSourceIds: args.allowedSourceIds,
    weakSourceBasis: args.weakSourceBasis ?? true
  });
  const invalidAnswer =
    !cleanAnswer ||
    cleanAnswer.length < 30 ||
    mainAnswerHasBlockedMetadata(result.answer) ||
    hasInvalidSourceIds ||
    !structuredValidation.ok;

  if (invalidAnswer) {
    return safeFallbackCaseAnswer({
      intent: args.intent,
      sourceIds: args.allowedSourceIds,
      nextActionTitle: args.nextActionTitle
    });
  }

  return {
    ...result,
    answer: cleanAnswer,
    sourceIds,
    validatedSources: result.validatedSources.filter((source) => sourceIds.includes(source.sourceId))
  };
}

const SYSTEM_STATUS_PATTERNS = [
  "hvor lenge",
  "hvor lang tid",
  "eta",
  "ferdig",
  "klar",
  "opplastet",
  "lastet opp",
  "gjenstår",
  "gjenstar",
  "mangler",
  "hva må jeg gjøre",
  "hva ma jeg gjore",
  "står på",
  "star pa",
  "prosent",
  "kildedekning",
  "ocr",
  "kontroll",
  "import",
  "behandling",
  "dokumentene",
  "alle dokumenter",
  "kan jeg bruke saken"
];

function isSystemStatusQuestion(question: string) {
  const normalized = question.toLowerCase();
  return SYSTEM_STATUS_PATTERNS.some((pattern) => normalized.includes(pattern));
}

function buildSystemStatusAnswer(status: CaseRoomSystemStatus): CaseAnswer {
  const total = status.totalDocuments;
  const completed = Math.max(0, total - status.remainingDocuments);
  const coverageLine = `Kildedekning: ${Math.round(status.sourceCoveragePercent)} %.`;
  const ocrLine =
    typeof status.ocrCoveragePercent === "number"
      ? `OCR/dekning: ${Math.round(status.ocrCoveragePercent)} %.`
      : status.pendingOcrPages > 0
        ? `${status.pendingOcrPages} sider venter på OCR/tekst.`
        : "OCR/dekning: ferdig for kjente sider.";

  if (status.isImporting && (status.remainingDocuments > 0 || status.processingDocuments > 0)) {
    const etaLine = status.etaLabel && status.etaLabel !== "Ferdig" ? status.etaLabel : "ETA beregnes ...";
    return {
      answer: [
        "Importen pågår fortsatt.",
        "",
        `${completed} av ${total} dokumenter er behandlet.`,
        `${status.remainingDocuments} ${status.remainingDocuments === 1 ? "dokument gjenstår" : "dokumenter gjenstår"}.`,
        `Fase: ${status.currentPhaseLabel}.`,
        etaLine,
        "",
        `Neste steg: ${status.nextActionTitle}.`
      ].join("\n"),
      sourceIds: [],
      validatedSources: [],
      answerStrength: {
        level: "Høy",
        reason: "Svaret bygger på intern import- og kontrollstatus, ikke på juridiske kildeutdrag."
      },
      uncertainty: "Lav for synlig appstatus. ETA er et estimat mens importen kjører.",
      missing: "Ingen juridisk vurdering er gjort i dette statussvaret.",
      nextStep: status.nextActionTitle
    };
  }

  if (status.attentionDocuments > 0 || status.failedDocuments > 0) {
    const failedLine =
      status.failedDocuments > 0 ? `\n${status.failedDocuments} dokument${status.failedDocuments === 1 ? "" : "er"} ble ikke brukt.` : "";
    return {
      answer: [
        "Dokumentene er importert, men saken er ikke helt klar ennå.",
        "",
        `${status.readyDocuments} av ${total} dokumenter er klare.`,
        `${status.attentionDocuments} dokument${status.attentionDocuments === 1 ? "" : "er"} må kontrolleres før de kan brukes.`,
        `${coverageLine}`,
        `${ocrLine}${failedLine}`,
        "",
        "ETA er ikke relevant nå, fordi importen ikke kjører. Neste steg er å starte kontroll.",
        "",
        "[Start kontroll]"
      ].join("\n"),
      sourceIds: [],
      validatedSources: [],
      answerStrength: {
        level: "Høy",
        reason: "Svaret bygger på intern dokumentstatus og kontrollkø."
      },
      uncertainty: "Lav for status. Eventuell juridisk bruk må vente til kontrollpunktene er lukket.",
      missing: "Kontroller dokumentene som fortsatt står i listen.",
      nextStep: "Start kontroll"
    };
  }

  return {
    answer: [
      "Alt er klart.",
      "",
      `Alle ${total} dokumenter er behandlet.`,
      coverageLine,
      "Du kan bruke Saksrom nå."
    ].join("\n"),
    sourceIds: [],
    validatedSources: [],
    answerStrength: {
      level: "Høy",
      reason: "Svaret bygger på intern ferdigstatus."
    },
    uncertainty: "Lav for appstatus.",
    missing: "Ingen åpne import- eller kontrollpunkter er synlige.",
    nextStep: status.nextActionTitle
  };
}

function shouldUseExternalAiProvider(status: CaseRoomSystemStatus) {
  void status;
  return false;
}

function parseStoredAnswer(
  message: CaseAiMessageDto,
  options?: {
    intent?: UserQuestionIntent;
    nextActionTitle?: string;
    allowedSourceIds?: string[];
  }
): { question: string; result: CaseAnswer } | null {
  const raw = message.answer_json || message.content;
  try {
    const parsed = JSON.parse(raw) as { question?: string; result?: CaseAnswer };
    if (!parsed.question || !parsed.result) {
      return null;
    }
    const sourceIds = options?.allowedSourceIds || message.sources.map((source) => source.source_id);
    const result = qualityGateCaseAnswer(
      {
        ...parsed.result,
        answer: normalizeAssistantAnswer(parsed.result.answer),
        validatedSources: message.sources.map((source) => ({
          sourceId: source.source_id,
          documentId: source.document_id,
          pageNumber: source.page_number,
          validationStatus: source.validation_status
        }))
      },
      {
        intent: options?.intent || classifyUserQuestion(parsed.question),
        allowedSourceIds: sourceIds,
        nextActionTitle: options?.nextActionTitle || "Åpne Kontrollstatus."
      }
    );
    return {
      question: parsed.question,
      result
    };
  } catch {
    return null;
  }
}

function getConversationStorage() {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

export function CaseRoomView({
  selectedCase,
  documents,
  sources,
  sourcesById,
  importQueue,
  isImporting,
  importNow,
  totalPageCount,
  processedPageCount,
  sourcePageCount,
  missingSourcePageCount,
  hasActiveProcessing,
  automaticTextRecognitionAvailable,
  pendingOcrPages,
  coverage,
  deviations,
  readiness,
  preliminaryBanner,
  nextActionTitle,
  systemStatus,
  onOpenSource,
  onOpenControl,
  onOpenSimulation,
  onRunCommand,
  onChooseDocuments,
  onChooseFolder,
  onImportPaths,
  onSaveCaseName
}: CaseRoomViewProps) {
  const [question, setQuestion] = useState("");
  const [caseNameInput, setCaseNameInput] = useState("");
  const [caseNameStatus, setCaseNameStatus] = useState("");
  const [isSavingCaseName, setIsSavingCaseName] = useState(false);
  const [isDropActive, setIsDropActive] = useState(false);
  const [answers, setAnswers] = useState<Array<{ question: string; result: CaseAnswer }>>([]);
  const [streamingAnswer, setStreamingAnswer] = useState<{ question: string; result: CaseAnswer; visibleAnswer: string } | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  const [autoFollowAnswer, setAutoFollowAnswer] = useState(true);
  const [workStateIndex, setWorkStateIndex] = useState(0);
  const [providerNotice, setProviderNotice] = useState("");
  const [latestSuggestedActions, setLatestSuggestedActions] = useState<SuggestedAction[]>([]);
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  const [activeCollaborationMode, setActiveCollaborationMode] = useState<CollaborationMode>("free_question");
  const [workstyle, setWorkstyle] = useState<WorkstylePreferences>(DEFAULT_WORKSTYLE_PREFERENCES);
  const hasSources = sources.length > 0;
  const hasDocuments = documents.length > 0;
  const isBlocked = readiness.verdict === "not_ready";
  const isPreliminaryOnly = readiness.verdict === "requires_control";
  const documentTotalPages = totalPageCount || documents.reduce((sum, document) => sum + document.page_count, 0);
  const queuedTotalPages = importQueue.reduce((sum, item) => sum + pageCountForImportItem(item), 0);
  const totalPages = Math.max(documentTotalPages, queuedTotalPages);
  const documentProcessedPages = documents.reduce((sum, document) => sum + (document.analyzed_page_count || 0), 0);
  const queuedProcessedPages = importQueue.reduce((sum, item) => sum + (item.pagesProcessed || 0), 0);
  const processedPages = Math.max(processedPageCount, documentProcessedPages, queuedProcessedPages);
  const pagesWithSources = sourcePageCount || (documentTotalPages > 0 ? Math.round((Math.max(0, Math.min(100, coverage)) / 100) * documentTotalPages) : 0);
  const selectedDocumentTotal = importQueue.length || documents.length;
  const documentsWithKnownPageCount =
    importQueue.length > 0
      ? importQueue.filter((item) => pageCountForImportItem(item) > 0).length
      : documents.filter((document) => document.page_count > 0).length;
  const pageCountingComplete =
    selectedDocumentTotal === 0 ||
    (totalPages > 0 && documentsWithKnownPageCount >= selectedDocumentTotal);
  const pageProgress = calculatePageProgress({
    totalPages,
    processedPages,
    pagesWithSources
  });
  const pagesMissingSources = missingSourcePageCount || pageProgress.pagesMissingSources;
  const processingPercent = totalPages > 0 ? Math.round((pageProgress.processedPages / totalPages) * 100) : 0;
  const intakeCoverage = totalPages > 0 ? pageProgress.sourceCoveragePercent : coverage;
  const processedDocuments = documents.filter((document) => document.source_count > 0 || document.analyzed_page_count > 0);
  const sourceCoverageTooLow = hasDocuments && intakeCoverage < 50;
  const canAsk = Boolean(selectedCase?.id && hasDocuments && hasSources && !isBlocked && !sourceCoverageTooLow);
  const isIncomplete = !hasSources || intakeCoverage < 95 || pendingOcrPages > 0 || deviations.length > 0 || pagesMissingSources > 0;
  const saksromScopeLabel =
    systemStatus.saksromScope === "full_case_sources"
      ? "Spør Saksrom — svar bygger på fullt kontrollert kildegrunnlag"
      : systemStatus.saksromScope === "controlled_sources_only"
        ? "Spør Saksrom — svar bygger bare på kontrollerte kilder"
        : "Saksrom åpnes når kildegrunnlaget er klart";
  const readyImportItems = importQueue.filter((item) => item.status === "completed");
  const documentProgressPercent = selectedDocumentTotal > 0 ? Math.round((readyImportItems.length / selectedDocumentTotal) * 100) : 0;
  const activeImportItem = importQueue.find((item) => !["completed", "failed"].includes(item.status));
  const displayImportItem = activeImportItem || importQueue.find((item) => item.status === "failed") || importQueue[importQueue.length - 1];
  const importPages = queuedTotalPages;
  const showIntakeCard = importQueue.length > 0 || isImporting;
  const liveImportProgress = importLiveProgressPercent(displayImportItem, importNow);
  const displayedIntakeProgress =
    pageCountingComplete && pageProgress.totalPages > 0
      ? processingPercent
      : selectedDocumentTotal > 0
        ? documentProgressPercent
        : liveImportProgress;
  const liveImportElapsed = displayImportItem?.startedAt ? formatDuration(importNow - displayImportItem.startedAt) : "";
  const liveCurrentStep = intakeStepLabel(displayImportItem);
  const intakeWorkState = activeIntakeWorkState(displayImportItem?.status);
  const processingActivityState = resolveProcessingActivityState({
    hasDocuments,
    isImporting,
    hasActiveProcessing,
    hasQueuedItems: importQueue.some((item) => toProcessingStage(item.status) === "queued"),
    hasFailedItems: importQueue.some((item) => toProcessingStage(item.status) === "failed"),
    pagesMissingSources,
    automaticTextRecognitionAvailable
  });
  const processingActivityText = processingActivityLabel(processingActivityState);
  const processingActivityExtra = processingActivityDetail(processingActivityState, pagesMissingSources, pageProgress.pagesWithSources);
  const isCaseSummaryReady =
    hasDocuments &&
    hasSources &&
    !isBlocked &&
    intakeCoverage >= 80 &&
    (readiness.verdict === "ready_for_draft_control" ||
      readiness.verdict === "ready_for_preliminary_analysis" ||
      intakeCoverage >= 95);
  const shouldShowNamingCard = Boolean(selectedCase?.id && isCaseSummaryReady && isTemporaryCaseTitle(selectedCase.name));
  const caseSummary = buildCaseSummarySections(selectedCase, sources, intakeCoverage, pendingOcrPages, deviations);
  const summaryWorkStates = [
    "Leser kilder",
    "Finner hovedtemaer",
    "Ser etter aktører",
    "Ser etter datoer og hendelser",
    "Lager saksoppsummering"
  ];
  const initialSuggestedActions = useMemo(
    () => (canAsk ? createDefaultSuggestedActions(`initial-${selectedCase?.id || "case"}`) : []),
    [canAsk, selectedCase?.id]
  );
  const activeSuggestedActions = latestSuggestedActions.length > 0 ? latestSuggestedActions : initialSuggestedActions;
  const visibleAnswers = [...answers].reverse();
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const processingCardRef = useRef<HTMLElement | null>(null);
  const caseSummaryRef = useRef<HTMLDivElement | null>(null);
  const namingCardRef = useRef<HTMLElement | null>(null);
  const assistantWorkRef = useRef<HTMLDivElement | null>(null);
  const chatInputRef = useRef<HTMLFormElement | null>(null);
  const activeAnswerRef = useRef<HTMLElement | null>(null);
  const autoFollowAnswerRef = useRef(true);
  const lastUserScrollAtRef = useRef(0);

  function scrollToLatestAnswer(behavior: ScrollBehavior = "smooth") {
    chatBottomRef.current?.scrollIntoView({ block: "end", behavior });
    setShowJumpToBottom(false);
  }

  function scrollToContextTarget(target: HTMLElement | null, behavior: ScrollBehavior = "smooth") {
    if (!target) {
      return;
    }
    target.scrollIntoView({
      behavior,
      block: "center"
    });
  }

  function scrollToActiveAnswer(behavior: ScrollBehavior = "smooth") {
    scrollToContextTarget(activeAnswerRef.current || chatBottomRef.current, behavior);
  }

  function scrollToAssistantWork(behavior: ScrollBehavior = "smooth") {
    scrollToContextTarget(assistantWorkRef.current || chatBottomRef.current, behavior);
  }

  function scrollToContextIfIdle(target: HTMLElement | null, behavior: ScrollBehavior = "smooth") {
    const userScrolledRecently = Date.now() - lastUserScrollAtRef.current < 1500;
    if (streamingAnswer || isAsking || isImporting || userScrolledRecently) {
      return;
    }
    window.requestAnimationFrame(() => scrollToContextTarget(target, behavior));
  }

  function updateAutoFollowAnswer(value: boolean) {
    autoFollowAnswerRef.current = value;
    setAutoFollowAnswer(value);
  }

  async function revealAnswer(turn: { question: string; result: CaseAnswer }) {
    setStreamingAnswer({
      ...turn,
      visibleAnswer: ""
    });
    updateAutoFollowAnswer(true);
    window.requestAnimationFrame(() => scrollToActiveAnswer("smooth"));

    let visibleAnswer = "";
    for (const chunk of splitForReveal(turn.result.answer)) {
      visibleAnswer += chunk;
      setStreamingAnswer({
        ...turn,
        visibleAnswer
      });
      window.requestAnimationFrame(() => {
        if (autoFollowAnswerRef.current) {
          scrollToActiveAnswer("smooth");
        }
      });
      await wait(Math.min(450, Math.max(120, chunk.length * 12)));
    }

    setAnswers((current) => [turn, ...current].slice(0, 20));
    setStreamingAnswer(null);
    window.requestAnimationFrame(() => scrollToActiveAnswer("smooth"));
  }

  useEffect(() => {
    const storage = getConversationStorage();
    if (storage) {
      setWorkstyle(readWorkstylePreferences(storage));
    }
  }, []);

  useEffect(() => {
    if (!selectedCase?.id) {
      setAnswers([]);
      setLatestSuggestedActions([]);
      setActiveCollaborationMode("free_question");
      return;
    }
    const storage = getConversationStorage();
    const memory = storage ? readCaseConversationMemory(storage, selectedCase.id) : createEmptyCaseConversationMemory(selectedCase.id);
    setLatestSuggestedActions(memory.suggestedActions);
    setActiveCollaborationMode(memory.activeCollaborationMode);
    listCaseAiMessages(selectedCase.id)
      .then((messages) => {
        const parsed = messages
          .map((message) => parseStoredAnswer(message, { nextActionTitle }))
          .filter(Boolean) as Array<{ question: string; result: CaseAnswer }>;
        setAnswers(parsed);
        setLatestSuggestedActions(memory.suggestedActions.length > 0 ? memory.suggestedActions : parsed[0]?.result.suggestedActions || []);
      })
      .catch(() => {
        setAnswers([]);
        setLatestSuggestedActions(memory.suggestedActions);
      });
  }, [selectedCase?.id]);

  useEffect(() => {
    setCaseNameInput("");
    setCaseNameStatus("");
  }, [selectedCase?.id]);

  useEffect(() => {
    if (!isAsking) {
      setWorkStateIndex(0);
      return;
    }

    const timer = window.setInterval(() => {
      setWorkStateIndex((current) => Math.min(current + 1, SAKSROM_WORK_STATES.length - 1));
    }, 700);

    return () => window.clearInterval(timer);
  }, [isAsking]);

  useEffect(() => {
    if (!isAsking && !streamingAnswer) {
      updateAutoFollowAnswer(true);
      return;
    }

    if (autoFollowAnswer) {
      if (streamingAnswer) {
        scrollToActiveAnswer("smooth");
      } else {
        scrollToAssistantWork("smooth");
      }
    }
  }, [isAsking, streamingAnswer?.visibleAnswer, workStateIndex, autoFollowAnswer]);

  useEffect(() => {
    if (!showIntakeCard) {
      return;
    }
    scrollToContextIfIdle(processingCardRef.current);
  }, [showIntakeCard, selectedCase?.id]);

  useEffect(() => {
    if (!isCaseSummaryReady) {
      return;
    }
    scrollToContextIfIdle(caseSummaryRef.current);
  }, [isCaseSummaryReady, coverage, selectedCase?.id]);

  useEffect(() => {
    if (!shouldShowNamingCard) {
      return;
    }
    scrollToContextIfIdle(namingCardRef.current);
  }, [shouldShowNamingCard, selectedCase?.id]);

  function handleChatScroll() {
    const container = chatScrollRef.current;
    if (!container) {
      return;
    }
    lastUserScrollAtRef.current = Date.now();

    const nearBottom = isNearBottom(container, 140);
    setShowJumpToBottom(!nearBottom);

    if (isAsking || streamingAnswer) {
      updateAutoFollowAnswer(nearBottom);
    }
  }

  function extractDroppedPaths(files: FileList) {
    return Array.from(files)
      .map((file) => (file as File & { path?: string }).path || "")
      .filter(Boolean);
  }

  function handleCaseRoomDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setIsDropActive(false);
    const paths = extractDroppedPaths(event.dataTransfer.files);
    if (paths.length > 0) {
      onImportPaths(paths);
    }
  }

  async function saveCaseName() {
    const nextName = caseNameInput.trim();
    if (!nextName) {
      setCaseNameStatus("Skriv et saksnavn først.");
      return;
    }
    setIsSavingCaseName(true);
    setCaseNameStatus("");
    try {
      await onSaveCaseName(nextName);
      setCaseNameInput("");
      setCaseNameStatus("Saksnavn er lagret.");
    } catch (error) {
      setCaseNameStatus(`Kunne ikke lagre saksnavn: ${String(error)}`);
    } finally {
      setIsSavingCaseName(false);
    }
  }

  function suggestCaseName() {
    const track = caseSummary.tracks[0] || "saksarbeid";
    setCaseNameInput(`Sak – ${track}`);
    setCaseNameStatus("Forslag laget lokalt. Det brukes bare hvis du lagrer navnet.");
  }

  async function askCase() {
    await submitCaseQuestion(question);
  }

  async function submitCaseQuestion(rawQuestion: string, selectedAction?: SuggestedAction) {
    const cleanQuestion = rawQuestion.trim();
    const resolvedAction = selectedAction || resolveSuggestedActionReply(cleanQuestion, activeSuggestedActions);
    const displayQuestion = resolvedAction?.label || cleanQuestion;
    const retrievalQuestion = resolvedAction?.queryTemplate || cleanQuestion;
    const activeMode = resolvedAction?.intent || inferCollaborationModeFromText(cleanQuestion);
    const questionIntent = classifyUserQuestion(retrievalQuestion || displayQuestion);

    if (!displayQuestion) {
      return;
    }
    if (isSystemStatusQuestion(retrievalQuestion || displayQuestion)) {
      if (!selectedCase?.id && !hasDocuments) {
        setProviderNotice("Importer dokumenter først, så kan Evida vise status for opplasting og kontroll.");
        return;
      }
      setActiveCollaborationMode(activeMode);
      setIsAsking(true);
      setProviderNotice("");
      updateAutoFollowAnswer(true);
      window.requestAnimationFrame(() => scrollToAssistantWork("smooth"));
      await wait(350);
      try {
        const result = buildSystemStatusAnswer(systemStatus);
        const answerJson = JSON.stringify({
          question: displayQuestion,
          result,
          model_id: "safe-local-system-status",
          prompt_version: "case_room_system_status_v1",
          source_index_version: `sources-${sources.length}`
        });
        if (selectedCase?.id) {
          await recordCaseAiExchange({
            caseId: selectedCase.id,
            question: displayQuestion,
            answerJson,
            sourceIds: [],
            modelId: "safe-local-system-status",
            promptVersion: "case_room_system_status_v1",
            sourceIndexVersion: `sources-${sources.length}`
          });
        }
        await revealAnswer({ question: displayQuestion, result });
        persistConversationTurn(result, [], activeMode, resolvedAction);
        setQuestion("");
      } catch (error) {
        setProviderNotice(`Kunne ikke hente dokumentstatus: ${String(error)}`);
      } finally {
        setIsAsking(false);
      }
      return;
    }
    if (questionIntent === "recommendation") {
      if (!selectedCase?.id) {
        setProviderNotice("Start med dokumenter, så oppretter Evida saken og kan anbefale tryggeste neste steg.");
        return;
      }
      setActiveCollaborationMode(activeMode);
      setIsAsking(true);
      setProviderNotice("");
      updateAutoFollowAnswer(true);
      window.requestAnimationFrame(() => scrollToAssistantWork("smooth"));
      await wait(700);
      try {
        const recommendationTurnId = `recommendation-${Date.now()}`;
        const nextSuggestedActions = createDefaultSuggestedActions(recommendationTurnId);
        const result = {
          ...buildRecommendationAnswer({
            selectedCase,
            sources,
            readiness,
            sourceCoveragePercent: intakeCoverage,
            pagesMissingSources,
            pagesRemainingProcessing: pageProgress.pagesRemaining,
            processingActivityState,
            etaLabel: importEta(activeImportItem, importNow),
            nextActionTitle
          }),
          suggestedActions: nextSuggestedActions
        };
        const answerJson = JSON.stringify({
          question: displayQuestion,
          result,
          model_id: "safe-local-recommendation-mode",
          prompt_version: "case_room_recommendation_v1",
          source_index_version: `sources-${sources.length}`
        });
        const persisted = await recordCaseAiExchange({
          caseId: selectedCase.id,
          question: displayQuestion,
          answerJson,
          sourceIds: result.sourceIds,
          modelId: "safe-local-recommendation-mode",
          promptVersion: "case_room_recommendation_v1",
          sourceIndexVersion: `sources-${sources.length}`
        });
        const stored = parseStoredAnswer(persisted, {
          intent: questionIntent,
          nextActionTitle,
          allowedSourceIds: result.sourceIds
        });
        setLatestSuggestedActions(nextSuggestedActions);
        await revealAnswer(stored || { question: displayQuestion, result });
        persistConversationTurn(result, nextSuggestedActions, activeMode, resolvedAction);
        setQuestion("");
      } catch (error) {
        setProviderNotice(`Kunne ikke lage anbefaling: ${String(error)}`);
      } finally {
        setIsAsking(false);
      }
      return;
    }
    if (!selectedCase?.id || !hasDocuments || !hasSources || sourceCoverageTooLow || isBlocked) {
      setProviderNotice(
        "Jeg kan svare på saken når dokumentene er lest og sporbare kilder er klare. Evida behandler dokumentene nå."
      );
      return;
    }
    setActiveCollaborationMode(activeMode);
    setIsAsking(true);
    setProviderNotice("");
    updateAutoFollowAnswer(true);
    window.requestAnimationFrame(() => scrollToAssistantWork("smooth"));
    await wait(900);
    if (cleanQuestion.startsWith("'")) {
      try {
        const commandTurnId = `command-${Date.now()}`;
        const nextSuggestedActions = createDefaultSuggestedActions(commandTurnId);
        const selectedSources = sources.slice(0, 3);
        const commandAnswer = await onRunCommand(cleanQuestion);
        const result: CaseAnswer = {
          answer: commandAnswer,
          sourceIds: selectedSources.map((source) => source.id),
          validatedSources: selectedSources.map((source) => ({
            sourceId: source.id,
            documentId: source.document_id,
            pageNumber: source.page_start,
            validationStatus: "LOCAL"
          })),
          answerStrength: {
            level: selectedSources.length > 0 ? "Middels" : "Lav",
            reason: "Kommandoen er kjørt lokalt og bundet til tilgjengelige kilder der det finnes kilder."
          },
          uncertainty: "Middels. Kontroller resultatet mot kildene før bruk.",
          missing: "Manuell juridisk vurdering og endelig kildekontroll.",
          nextStep: nextActionTitle,
          suggestedActions: nextSuggestedActions
        };
        const answerJson = JSON.stringify({
          question: displayQuestion,
          result,
          model_id: "safe-local-command-mode",
          prompt_version: "case_room_command_v1",
          source_index_version: `sources-${sources.length}`
        });
        const persisted = await recordCaseAiExchange({
          caseId: selectedCase.id,
          question: displayQuestion,
          answerJson,
          sourceIds: result.sourceIds,
          modelId: "safe-local-command-mode",
          promptVersion: "case_room_command_v1",
          sourceIndexVersion: `sources-${sources.length}`
        });
        const stored = parseStoredAnswer(persisted, {
          intent: questionIntent,
          nextActionTitle,
          allowedSourceIds: result.sourceIds
        });
        setLatestSuggestedActions(nextSuggestedActions);
        await revealAnswer(stored || { question: displayQuestion, result });
        persistConversationTurn(result, nextSuggestedActions, activeMode, resolvedAction);
        setQuestion("");
      } catch (error) {
        setProviderNotice(`Kommandoen kunne ikke kjøres: ${String(error)}`);
      } finally {
        setIsAsking(false);
      }
      return;
    }
    if (shouldUseExternalAiProvider(systemStatus)) {
      try {
        const providerMessage = await askCaseAi({
          caseId: selectedCase.id,
          question: retrievalQuestion,
          coverage,
          pendingOcrPages,
          deviations,
          nextActionTitle
        });
        const providerAnswer = parseStoredAnswer(providerMessage, {
          intent: questionIntent,
          nextActionTitle,
          allowedSourceIds: sources.map((source) => source.id)
        });
        if (providerAnswer) {
          const nextSuggestedActions = createDefaultSuggestedActions(providerMessage.id);
          const answerWithActions = {
            question: displayQuestion,
            result: {
              ...providerAnswer.result,
              suggestedActions: nextSuggestedActions
            }
          };
          await revealAnswer(answerWithActions);
          setLatestSuggestedActions(nextSuggestedActions);
          persistConversationTurn(answerWithActions.result, nextSuggestedActions, activeMode, resolvedAction);
          setQuestion("");
          return;
        }
        setProviderNotice("Sikker lokalmodus aktiv: ekstern AI svarte ikke med gyldig struktur, så Evida bruker lokale kildeutdrag.");
      } catch {
        setProviderNotice("Sikker lokalmodus aktiv: ekstern AI er av eller utilgjengelig. Evida bruker bare lokale kildeutdrag fra saken.");
      }
    } else {
      setProviderNotice("Sikker lokalmodus aktiv: ekstern AI-provider er policy-blokkert. Evida bruker bare kontrollerte lokale kildeutdrag.");
    }

    setIsAsking(true);
    const localTurnId = `local-${Date.now()}`;
    const nextSuggestedActions = createDefaultSuggestedActions(localTurnId);
    const sourceScopeNotice =
      systemStatus.saksromScope === "controlled_sources_only"
        ? `Kildeomfang: Saksrom svarer bare fra kontrollerte kilder. ${systemStatus.excludedDocuments} dokumenter er holdt utenfor.`
        : systemStatus.saksromScope === "full_case_sources"
          ? "Kildeomfang: Saksrom bruker fullt kontrollert kildegrunnlag."
          : "Kildeomfang: Saksrom har ikke et trygt kildegrunnlag ennå.";
    const result = {
      ...buildAnswer(retrievalQuestion, sources, coverage, deviations, pendingOcrPages, nextActionTitle),
      suggestedActions: nextSuggestedActions
    };
    result.answer = `${sourceScopeNotice}\n\n${result.answer}`;
    result.answerStrength = {
      ...result.answerStrength,
      reason: `${result.answerStrength.reason} ${sourceScopeNotice}`
    };
    const answerJson = JSON.stringify({
      question: displayQuestion,
      result,
      model_id: "safe-local-source-mode",
      prompt_version: "case_room_safe_local_v1",
      source_index_version: `sources-${sources.length}`
    });
    const persisted = await recordCaseAiExchange({
      caseId: selectedCase.id,
      question: displayQuestion,
      answerJson,
      sourceIds: result.sourceIds,
      modelId: "safe-local-source-mode",
      promptVersion: "case_room_safe_local_v1",
      sourceIndexVersion: `sources-${sources.length}`
    });
    const stored = parseStoredAnswer(persisted, {
      intent: questionIntent,
      nextActionTitle,
      allowedSourceIds: result.sourceIds
    });
    setLatestSuggestedActions(nextSuggestedActions);
    await revealAnswer(stored || { question: displayQuestion, result });
    persistConversationTurn(result, nextSuggestedActions, activeMode, resolvedAction);
    setQuestion("");
    setIsAsking(false);
  }

  function persistConversationTurn(
    result: CaseAnswer,
    suggestedActions: SuggestedAction[],
    activeMode: CollaborationMode,
    selectedAction?: SuggestedAction
  ) {
    const storage = getConversationStorage();
    if (!storage || !selectedCase?.id) {
      return;
    }

    updateCaseConversationMemory(storage, selectedCase.id, {
      previousAssistantAnswer: result.answer,
      suggestedActions,
      selectedAction,
      activeCollaborationMode: activeMode,
      retrievalSnapshot: {
        sourceIds: result.sourceIds,
        sourceCoveragePercent: coverage,
        pendingTextRecognitionPages: pendingOcrPages,
        sourceIndexVersion: `sources-${sources.length}`
      },
      sourcesUsed: result.sourceIds
    });
  }

  function updateWorkstyle(patch: Partial<WorkstylePreferences>) {
    const storage = getConversationStorage();
    const next = {
      ...workstyle,
      ...patch
    };
    setWorkstyle(next);
    if (storage) {
      writeWorkstylePreferences(storage, next);
    }
  }

  return (
    <section
      className={`case-chat-shell ${isDropActive ? "case-chat-shell--drop-active" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDropActive(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) {
          setIsDropActive(false);
        }
      }}
      onDrop={handleCaseRoomDrop}
    >
      {isDropActive ? (
        <div className="case-drop-overlay" aria-hidden="true">
          <strong>Slipp dokumentene her for å starte saken</strong>
        </div>
      ) : null}
      <div className="case-chat-scroll" ref={chatScrollRef} onScroll={handleChatScroll}>
        <header className="case-chat-header">
          <p className="eyebrow">Saksrom</p>
          <h2>{selectedCase?.name || "Saksrom"}</h2>
          {hasDocuments ? (
          <div className="case-summary-card" ref={caseSummaryRef}>
            <div className="case-room-status-row">
              <span className="local-pill">Sikker lokalmodus</span>
              <span className="case-room-status-note">Ekstern AI er av. Svar bygger kun på lokale kilder i saken.</span>
              <span className="case-mode-chip">Arbeidsmodus: {COLLABORATION_MODE_LABELS[activeCollaborationMode]}</span>
              <button type="button" className="button-ghost case-room-status-link" onClick={onOpenControl}>
                Vis kontrollstatus
              </button>
            </div>
            {preliminaryBanner ? (
              <div className="warning-notice case-room-preliminary-banner">{preliminaryBanner}</div>
            ) : null}
            {systemStatus.saksromScope === "controlled_sources_only" ? (
              <div className="warning-notice case-room-preliminary-banner">
                Saksrom bruker bare kontrollerte kilder. {systemStatus.excludedDocuments} dokumenter er foreløpig holdt utenfor svargrunnlaget.
              </div>
            ) : null}
            {isCaseSummaryReady ? (
              <div className="case-summary-content">
                <h3 className="case-summary-title">{coverage >= 95 ? "Saksoppsummering" : "Foreløpig saksoppsummering"}</h3>
                <section className="case-summary-section">
                  <h4 className="case-summary-section-label">Kort fortalt</h4>
                  <p className="case-summary-lead">{caseSummary.short}</p>
                </section>
                <section className="case-summary-section">
                  <h4 className="case-summary-section-label">Viktigste punkter</h4>
                  <ul className="case-summary-bullets">
                    {caseSummary.keyPoints.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </section>
                <section className="case-summary-section">
                  <h4 className="case-summary-section-label">Sentrale aktører</h4>
                  <div className="case-summary-chip-list">
                    {caseSummary.actors.map((actor) => (
                      <span className="case-summary-chip" key={actor}>{actor}</span>
                    ))}
                  </div>
                </section>
                <section className="case-summary-section">
                  <h4 className="case-summary-section-label">Mulige hovedspor</h4>
                  <div className="case-track-list">
                    {caseSummary.tracks.map((track) => (
                      <span className="case-track-pill" key={track}>{track}</span>
                    ))}
                  </div>
                </section>
                <section className="case-summary-section">
                  <div className="case-summary-callout case-summary-callout-warning">
                    <div className="case-summary-callout-title">Usikkerhet / må kontrolleres</div>
                    <ul className="case-summary-callout-list">
                      {caseSummary.uncertainty.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </section>
                <section className="case-summary-section">
                  <h4 className="case-summary-section-label">Anbefalte neste steg</h4>
                  <div className="case-summary-actions">
                    {caseSummary.nextSteps.map((action) => (
                      <button key={action} type="button" className="button-secondary" onClick={() => void submitCaseQuestion(action)}>
                        {action}
                      </button>
                    ))}
                  </div>
                </section>
              </div>
            ) : (
              <div className="case-summary-generating">
                <h3>{hasDocuments ? "Saksoppsummering genereres" : "Importer dokumenter først"}</h3>
                <p>
                  {hasDocuments
                    ? "Evida lager en saksoppsummering basert på de sporbare kildene. Dette skal normalt vises automatisk når dokumentgrunnlaget er klart."
                    : "Saksrom blir tilgjengelig som oppsummering og samtale når saken har dokumentgrunnlag."}
                </p>
                {hasDocuments ? (
                  <div className="summary-work-states" aria-label="Saksoppsummering under arbeid">
                    {summaryWorkStates.map((state) => (
                      <span key={state}>{state}</span>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
            <details className="workstyle-settings">
              <summary>Tilpass Saksrom til måten jeg jobber på</summary>
              <div className="workstyle-grid">
                <label>
                  Svarlengde
                  <select
                    value={workstyle.answerLength}
                    onChange={(event) => updateWorkstyle({ answerLength: event.target.value as WorkstylePreferences["answerLength"] })}
                  >
                    <option value="short">Korte svar</option>
                    <option value="balanced">Balanserte svar</option>
                    <option value="detailed">Detaljerte svar</option>
                  </select>
                </label>
                <label>
                  Rekkefølge
                  <select
                    value={workstyle.citationPlacement}
                    onChange={(event) =>
                      updateWorkstyle({ citationPlacement: event.target.value as WorkstylePreferences["citationPlacement"] })
                    }
                  >
                    <option value="assessment_first">Vurdering først</option>
                    <option value="sources_first">Kilder først</option>
                  </select>
                </label>
                <label>
                  Arbeidsmodus
                  <select
                    value={workstyle.preferredCollaborationMode}
                    onChange={(event) =>
                      updateWorkstyle({ preferredCollaborationMode: event.target.value as WorkstylePreferences["preferredCollaborationMode"] })
                    }
                  >
                    {Object.entries(COLLABORATION_MODE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={workstyle.showNextSuggestions}
                    onChange={(event) => updateWorkstyle({ showNextSuggestions: event.target.checked })}
                  />
                  Vis alltid neste spor
                </label>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={workstyle.showDetailedWorkStates}
                    onChange={(event) => updateWorkstyle({ showDetailedWorkStates: event.target.checked })}
                  />
                  Vis arbeidstrinn mens Evida svarer
                </label>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={workstyle.adaptationEnabled}
                    onChange={(event) => updateWorkstyle({ adaptationEnabled: event.target.checked })}
                  />
                  Tilpass lokalt
                </label>
              </div>
            </details>
            {isBlocked ? (
              <div className="case-soft-warning" role="alert">
                <span>Saken klargjøres. Evida lager sporbare kilder automatisk.</span>
                <button type="button" className="button-secondary" onClick={onOpenControl}>
                  Se behandlingsstatus
                </button>
              </div>
            ) : isIncomplete ? (
              <div className="case-soft-warning">
                <span>{isPreliminaryOnly ? "Foreløpig: lav eller ufullstendig dekning." : "Dokumentgrunnlaget er ikke komplett. Svar kan være ufullstendige."}</span>
                <button type="button" className="button-secondary" onClick={onOpenControl}>
                  Vis kontrollstatus
                </button>
              </div>
            ) : null}
          </div>
          ) : null}
        </header>

        <div className="case-chat-messages">
          {showIntakeCard ? (
            <article className="case-system-card" aria-live="polite" ref={processingCardRef}>
              <h3>{isImporting ? "Saken klargjøres" : "Dokumenter mottatt"}</h3>
              <p>
                {isImporting
                  ? "Evida leser dokumentene og lager sporbare kilder automatisk."
                  : `Evida har mottatt ${importQueue.length} dokumenter og behandler dem automatisk. Du trenger ikke gjøre noe.`}
              </p>
              <div className="case-live-progress" aria-label={`Dokumentbehandling ${displayedIntakeProgress} prosent`}>
                <div className="case-live-progress__track">
                  <div className="case-live-progress__bar" style={{ width: `${displayedIntakeProgress}%` }} />
                </div>
                <strong>{displayedIntakeProgress}%</strong>
              </div>
              <div className="case-intake-steps" aria-live="polite">
                {intakeWorkState.stepViews.map((step) => (
                  <span key={step.stage} className={`is-${step.state}`}>
                    {step.label}
                  </span>
                ))}
              </div>
              <p className="muted">
                {processingActivityText}
                {processingActivityExtra ? ` ${processingActivityExtra}` : ""}
              </p>
              <div className="case-intake-grid">
                <span>Dokumenter</span>
                <strong>{readyImportItems.length}/{importQueue.length || documents.length}</strong>
                <span>Behandling</span>
                <strong>{pageCountingComplete && pageProgress.totalPages > 0 ? `${processingPercent} %` : `${displayedIntakeProgress} %`}</strong>
                <span>Sider</span>
                <strong>
                  {pageCountingComplete && pageProgress.totalPages > 0
                    ? `${pageProgress.processedPages} av ${pageProgress.totalPages} sider behandlet`
                    : importPages > 0
                      ? `${importPages} sider telt så langt`
                      : "Teller totalt antall sider"}
                </strong>
                <span>Gjenstår behandling</span>
                <strong>
                  {pageCountingComplete && pageProgress.totalPages > 0
                    ? `${pageProgress.pagesRemaining} sider gjenstår`
                    : selectedDocumentTotal > documentsWithKnownPageCount
                      ? `${selectedDocumentTotal - documentsWithKnownPageCount} dokumenter gjenstår sidetelling`
                      : "Beregnes når sidetelling er ferdig"}
                </strong>
                <span>Sider med kilder</span>
                <strong>
                  {pageCountingComplete && pageProgress.totalPages > 0
                    ? `${pageProgress.pagesWithSources} av ${pageProgress.totalPages}`
                    : pageProgress.totalPages > 0
                      ? `${pageProgress.pagesWithSources} av ${pageProgress.totalPages} kjente sider`
                    : sources.length > 0
                      ? `${sources.length} kilder`
                      : "Beregnes"}
                </strong>
                <span>Sider som mangler</span>
                <strong>
                  {pageCountingComplete && pageProgress.totalPages > 0
                    ? pagesMissingSources
                    : pageProgress.totalPages > 0
                      ? `${pageProgress.pagesMissingSources} kjente sider`
                      : "Beregnes"}
                </strong>
                <span>Kildedekning</span>
                <strong>
                  {pageCountingComplete && pageProgress.totalPages > 0
                    ? `${Math.round(intakeCoverage)} %`
                    : pageProgress.totalPages > 0
                      ? `${Math.round(intakeCoverage)} % av kjente sider`
                      : "Beregnes etter sidetelling"}
                </strong>
                <span>Nåværende steg</span>
                <strong>{liveCurrentStep}</strong>
                <span>Estimert tid</span>
                <strong>{importEta(activeImportItem, importNow)}</strong>
                {isImporting && liveImportElapsed ? (
                  <>
                    <span>Arbeidstid</span>
                    <strong>{liveImportElapsed}</strong>
                  </>
                ) : null}
              </div>
              {false && importQueue.length > 0 ? (
                <div className="case-import-file-list">
                  {importQueue.map((item) => (
                    <div key={item.path} className={`case-import-file case-import-file--${item.status}`}>
                      <span className="case-import-file__pulse" aria-hidden="true" />
                      <div>
                        <strong>{item.name}</strong>
                        <span>
                          {processingStageLabel(toProcessingStage(item.status))}
                          {isImporting && item.path === displayImportItem?.path && liveImportElapsed ? ` · fortsatt aktiv · ${liveImportElapsed}` : ""}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
              {isImporting ? <p className="muted">Store eller skannede dokumenter kan ta litt tid.</p> : null}
            </article>
          ) : null}
          {shouldShowNamingCard ? (
            <article className="case-system-card case-naming-card" ref={namingCardRef}>
              <h3>Navngi saken</h3>
              <p>Gi saken et navn som gjør den lett å finne igjen under Tidligere saker.</p>
              <label>
                Saksnavn
                <input
                  value={caseNameInput}
                  onChange={(event) => setCaseNameInput(event.target.value)}
                  placeholder="F.eks. Arbeidsrett – oppsigelse 2024"
                />
              </label>
              <div className="case-naming-actions">
                <button type="button" className="button-primary" onClick={() => void saveCaseName()} disabled={isSavingCaseName}>
                  {isSavingCaseName ? "Lagrer ..." : "Lagre navn"}
                </button>
                <button type="button" className="button-secondary" onClick={() => setCaseNameStatus("Du kan navngi saken senere.")}>
                  Gjør senere
                </button>
                <button type="button" className="button-ghost" onClick={suggestCaseName}>
                  Foreslå navn
                </button>
              </div>
              {caseNameStatus ? <p className="muted">{caseNameStatus}</p> : null}
            </article>
          ) : null}
          {visibleAnswers.length === 0 ? (
            <div className="case-empty-chat">
              <h3>{!hasDocuments ? "Last opp dokumenter først" : isBlocked || sourceCoverageTooLow ? "Saken klargjøres" : "Spør saken"}</h3>
              <p>
                {!hasDocuments
                  ? "Dra dokumenter hit, eller trykk + ved meldingsfeltet for å laste opp. Evida leser dokumentene, lager sporbare kilder og viser en saksoppsummering når grunnlaget er klart."
                  : isBlocked || sourceCoverageTooLow
                  ? "Evida lager sporbare kilder automatisk. Saksrom åpnes når dokumentgrunnlaget er klart."
                  : "Still spørsmål om dokumentene. Svar viser kilder, usikkerhet og hva som mangler."}
              </p>
              {!hasDocuments ? (
                <div className="case-summary-actions">
                  <button type="button" className="button-primary" onClick={onChooseDocuments}>
                    Velg dokumenter
                  </button>
                  <button type="button" className="button-secondary" onClick={onChooseFolder}>
                    Velg saksmappe
                  </button>
                </div>
              ) : null}
              {hasDocuments && !sourceCoverageTooLow && activeSuggestedActions.length > 0 ? (
                <div className="case-suggested-actions case-suggested-actions--initial">
                  <strong>Velg et spor, eller skriv 1-4</strong>
                  <div className="case-suggested-actions__grid">
                    {activeSuggestedActions.map((action) => (
                      <button
                        key={action.id}
                        type="button"
                        className="button-ghost"
                        onClick={() => void submitCaseQuestion(action.label, action)}
                      >
                        {action.index}. {action.label}
                      </button>
                    ))}
                  </div>
                  <span>Du kan også spørre fritt.</span>
                </div>
              ) : null}
            </div>
          ) : (
            visibleAnswers.map((entry, index) => (
              <article key={`${entry.question}-${index}`} className="case-message-group" ref={index === 0 ? activeAnswerRef : undefined}>
                <div className="case-message case-message--user">{entry.question}</div>
                <div className="case-message case-message--assistant">
                  <div className="case-answer-body">{entry.result.answer}</div>
                  <details className="case-answer-details">
                    <summary>Kilder, usikkerhet og neste steg</summary>
                    <div className="case-answer-meta">
                      <p>
                        <strong>Svarstyrke:</strong> {entry.result.answerStrength.level}: {entry.result.answerStrength.reason}
                      </p>
                      <p>
                        <strong>Usikkerhet:</strong> {entry.result.uncertainty}
                      </p>
                      <p>
                        <strong>Hva mangler:</strong> {entry.result.missing}
                      </p>
                      <p>
                        <strong>Neste steg:</strong> {entry.result.nextStep}
                      </p>
                    </div>
                    {entry.result.validatedSources.length > 0 ? (
                      <div className="case-source-list">
                        {entry.result.validatedSources.map((sourceRef) => {
                          const source = sourcesById.get(sourceRef.sourceId);
                          return (
                            <button
                              key={sourceRef.sourceId}
                              type="button"
                              className="case-source-pill"
                              onClick={() => onOpenSource(sourceRef.sourceId)}
                            >
                              <strong>{sourceRef.documentId} · side {sourceRef.pageNumber || "?"}</strong>
                              <span>{source ? firstSentence(source.text_excerpt) : "Kilde mangler i lokal indeks."}</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="muted">Mangler kilde.</p>
                    )}
                  </details>
                  {entry.result.suggestedActions?.length && workstyle.showNextSuggestions ? (
                    <div className="case-suggested-actions">
                      <strong>Mulige spor å undersøke videre</strong>
                      <div className="case-suggested-actions__grid">
                        {entry.result.suggestedActions.map((action) => (
                          <button
                            key={action.id}
                            type="button"
                            className="button-ghost"
                            onClick={() => void submitCaseQuestion(action.label, action)}
                          >
                            {action.index}. {action.label}
                          </button>
                        ))}
                      </div>
                      <button type="button" className="button-secondary" onClick={onOpenSimulation}>
                        Test i Rettssimulering
                      </button>
                      <span>Du kan også spørre fritt.</span>
                    </div>
                  ) : null}
                </div>
              </article>
            ))
          )}
          {streamingAnswer ? (
            <article className="case-message-group" ref={activeAnswerRef}>
              <div className="case-message case-message--user">{streamingAnswer.question}</div>
              <div className="case-message case-message--assistant case-message--streaming">
                <div className="case-answer-body">{streamingAnswer.visibleAnswer}</div>
              </div>
            </article>
          ) : null}
          {providerNotice ? <div className="case-provider-notice">{providerNotice}</div> : null}
          <div ref={assistantWorkRef}>
            <AssistantWorkState active={isAsking && !streamingAnswer && workstyle.showDetailedWorkStates} currentStep={workStateIndex} />
          </div>
          <div ref={chatBottomRef} className="case-chat-bottom-anchor" aria-hidden="true" />
        </div>
      </div>
      {(isAsking || streamingAnswer) && !autoFollowAnswer ? (
        <button
          type="button"
          className="follow-answer-button"
          onClick={() => {
            updateAutoFollowAnswer(true);
            scrollToLatestAnswer("smooth");
          }}
        >
          Følg svaret
        </button>
      ) : null}
      {!isAsking && !streamingAnswer && showJumpToBottom ? (
        <button type="button" className="follow-answer-button" onClick={() => scrollToLatestAnswer("smooth")}>
          Hopp nederst
        </button>
      ) : null}

      <form
        ref={chatInputRef}
        className="case-chat-composer"
        onSubmit={(event) => {
          event.preventDefault();
          void askCase();
        }}
      >
        <button
          type="button"
          className="case-chat-add-button"
          title="Legg til dokumenter"
          aria-label="Legg til dokumenter"
          onClick={onChooseDocuments}
          disabled={isImporting}
        >
          +
        </button>
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void askCase();
            }
          }}
          placeholder={
            !hasDocuments
              ? "Legg til dokumenter for å starte"
              : isBlocked || sourceCoverageTooLow
                ? "Saksrom åpnes når dokumentgrunnlaget er klart"
                : saksromScopeLabel
          }
          rows={1}
          disabled={!hasDocuments || isAsking}
          aria-disabled={!hasDocuments || isAsking}
        />
        <button type="submit" className="button-primary" disabled={!question.trim() || !selectedCase?.id || !canAsk || isAsking}>
          {isAsking ? "Svarer ..." : "Send"}
        </button>
      </form>
    </section>
  );
}
