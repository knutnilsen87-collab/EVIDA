import { useEffect, useRef, useState } from "react";
import type { DragEvent } from "react";
import type { CaseAiMessageDto, CaseSummary, DocumentSummary, SourceObjectSummary } from "../types";
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
import { SAKSROM_WORK_STATES } from "../features/adaptiveSaksrom/workStates";
import {
  DEFAULT_WORKSTYLE_PREFERENCES,
  readWorkstylePreferences,
  writeWorkstylePreferences
} from "../features/adaptiveSaksrom/workstyle";
import type { WorkstylePreferences } from "../features/adaptiveSaksrom/workstyle";

interface CaseRoomViewProps {
  selectedCase?: CaseSummary;
  documents: DocumentSummary[];
  sources: SourceObjectSummary[];
  sourcesById: Map<string, SourceObjectSummary>;
  importQueue: CaseRoomImportItem[];
  isImporting: boolean;
  importNow: number;
  pendingOcrPages: number;
  coverage: number;
  deviations: string[];
  readiness: ReadinessResult;
  nextActionTitle: string;
  onOpenSource: (sourceId: string) => void;
  onOpenControl: () => void;
  onOpenSimulation: () => void;
  onRunCommand: (input: string) => Promise<string>;
  onChooseDocuments: () => void;
  onImportPaths: (paths: string[]) => void;
  onSaveCaseName: (name: string) => Promise<void>;
}

interface CaseRoomImportItem {
  path: string;
  name: string;
  status: "selected" | "validating" | "hashing" | "extracting" | "chunking" | "ready" | "needs_attention" | "failed";
  detail: string;
  pages?: number;
  sources?: number;
  startedAt?: number;
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
    representativeSources.map((source) => firstSentence(source.text_excerpt)).filter((line) => line.length > 12),
    6
  );
  const actors = extractActorsFromSources(representativeSources);
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
  const answerSentences = selected.map((source) => firstSentence(source.text_excerpt));
  const importantPoints = answerSentences.length > 0 ? answerSentences : ["Jeg finner ikke et tydelig kildepunkt ennå."];
  const needsCaution = coverage < 95 || pendingOcrPages > 0 || deviations.length > 0;

  return [
    "Kort svar",
    `Basert på kildene som er klare, er det viktigste jeg finner: ${importantPoints[0]}`,
    "",
    "Viktigste punkter",
    ...importantPoints.slice(0, 4).map((point) => `- ${point}`),
    "",
    "Hva dette bygger på",
    `- ${selected.length} sporbare kildeutdrag fra valgt sak.`,
    "- Kildene er hentet lokalt og kan åpnes under svaret.",
    "",
    "Usikkerhet / mangler",
    needsCaution
      ? "- Svaret er foreløpig fordi dokumentgrunnlaget eller tekstkontrollen ikke er helt komplett."
      : "- Grunnlaget ser klart ut for foreløpig saksarbeid, men må kontrolleres faglig.",
    deviations.length > 0 ? `- Kontrollavvik: ${deviations.join(" ")}` : "- Ingen særskilte kontrollavvik vises i dette svaret.",
    "",
    "Neste spor å undersøke",
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

function importEta(item: CaseRoomImportItem | undefined, nowMs: number) {
  if (!item) {
    return "Beregnes";
  }
  const elapsed = item.startedAt ? nowMs - item.startedAt : 0;
  if (["ready", "needs_attention", "failed"].includes(item.status)) {
    return item.startedAt ? `Brukte ${formatDuration(elapsed)}` : "Ferdig";
  }
  if (item.status === "extracting") {
    if (elapsed < 30_000) {
      return "Omtrent 1-3 min igjen";
    }
    if (elapsed < 120_000) {
      return "Omtrent 1-2 min igjen";
    }
    return "Tar litt tid med stort dokument";
  }
  if (item.status === "chunking") {
    return "Omtrent under 1 min igjen";
  }
  return elapsed > 2000 ? "Omtrent under 1 min igjen" : "Starter straks";
}

function intakeStepLabel(item: CaseRoomImportItem | undefined) {
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
}

function importLiveProgressPercent(item: CaseRoomImportItem | undefined, nowMs: number) {
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
}

function activeIntakeWorkState(nowMs: number) {
  const states = [
    "Leser fil",
    "Teller sider",
    "Henter tekst",
    "Finner kildepunkter",
    "Bygger saksgrunnlag"
  ];
  return {
    states,
    activeIndex: Math.floor(nowMs / 1400) % states.length
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
        "Viktigste punkter",
        "- Saksrom trenger minst ett kildeutdrag før svaret kan bli etterprøvbart.",
        "",
        "Hva dette bygger på",
        "- Ingen lokale kilder er tilgjengelige.",
        "",
        "Usikkerhet / mangler",
        "- Kildegrunnlag mangler.",
        "",
        "Neste spor å undersøke",
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

function parseStoredAnswer(message: CaseAiMessageDto): { question: string; result: CaseAnswer } | null {
  const raw = message.answer_json || message.content;
  try {
    const parsed = JSON.parse(raw) as { question?: string; result?: CaseAnswer };
    if (!parsed.question || !parsed.result) {
      return null;
    }
    return {
      question: parsed.question,
      result: {
        ...parsed.result,
        answer: normalizeAssistantAnswer(parsed.result.answer),
        validatedSources: message.sources.map((source) => ({
          sourceId: source.source_id,
          documentId: source.document_id,
          pageNumber: source.page_number,
          validationStatus: source.validation_status
        }))
      }
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
  pendingOcrPages,
  coverage,
  deviations,
  readiness,
  nextActionTitle,
  onOpenSource,
  onOpenControl,
  onOpenSimulation,
  onRunCommand,
  onChooseDocuments,
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
  const [activeCollaborationMode, setActiveCollaborationMode] = useState<CollaborationMode>("free_question");
  const [workstyle, setWorkstyle] = useState<WorkstylePreferences>(DEFAULT_WORKSTYLE_PREFERENCES);
  const hasSources = sources.length > 0;
  const hasDocuments = documents.length > 0;
  const isBlocked = readiness.verdict === "not_ready";
  const isPreliminaryOnly = readiness.verdict === "requires_control";
  const totalPages = documents.reduce((sum, document) => sum + document.page_count, 0);
  const processedDocuments = documents.filter((document) => document.source_count > 0 || document.analyzed_page_count > 0);
  const sourceCoverageTooLow = hasDocuments && coverage < 50;
  const canAsk = Boolean(selectedCase?.id && hasDocuments && hasSources && !isBlocked && !sourceCoverageTooLow);
  const isIncomplete = !hasSources || coverage < 95 || pendingOcrPages > 0 || deviations.length > 0;
  const readyImportItems = importQueue.filter((item) => ["ready", "needs_attention"].includes(item.status));
  const activeImportItem = importQueue.find((item) => !["ready", "needs_attention", "failed"].includes(item.status));
  const importPages = importQueue.reduce((sum, item) => sum + (item.pages || 0), 0);
  const importSources = importQueue.reduce((sum, item) => sum + (item.sources || 0), 0);
  const intakeCoverage = totalPages > 0 ? Math.round((sources.length > 0 ? coverage : importSources > 0 && importPages > 0 ? Math.min(100, (importSources / importPages) * 100) : 0)) : coverage;
  const showIntakeCard = importQueue.length > 0 || isImporting;
  const liveImportProgress = importLiveProgressPercent(activeImportItem || importQueue[0], importNow);
  const intakeWorkState = activeIntakeWorkState(importNow);
  const isCaseSummaryReady =
    hasDocuments &&
    hasSources &&
    !isBlocked &&
    (readiness.verdict === "ready_for_draft_control" ||
      readiness.verdict === "ready_for_preliminary_analysis" ||
      coverage >= 95 ||
      (pendingOcrPages === 0 && processedDocuments.length > 0));
  const shouldShowNamingCard = Boolean(selectedCase?.id && isCaseSummaryReady && isTemporaryCaseTitle(selectedCase.name));
  const caseSummary = buildCaseSummarySections(selectedCase, sources, coverage, pendingOcrPages, deviations);
  const summaryWorkStates = [
    "Leser kilder",
    "Finner hovedtemaer",
    "Ser etter aktører",
    "Ser etter datoer og hendelser",
    "Lager saksoppsummering"
  ];
  const suggestedQuestions = isBlocked
    ? []
    : isPreliminaryOnly
      ? ["Hva er ferdig behandlet?", "Hva mangler?", "Hva bør kontrolleres først?"]
      : ["Hva er dokumentert?", "Hva mangler?", "Hva bør kontrolleres først?"];
  const visibleAnswers = [...answers].reverse();
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const autoFollowAnswerRef = useRef(true);

  function scrollToLatestAnswer(behavior: ScrollBehavior = "smooth") {
    chatBottomRef.current?.scrollIntoView({ block: "end", behavior });
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
    window.requestAnimationFrame(() => scrollToLatestAnswer("smooth"));

    let visibleAnswer = "";
    for (const chunk of splitForReveal(turn.result.answer)) {
      visibleAnswer += chunk;
      setStreamingAnswer({
        ...turn,
        visibleAnswer
      });
      window.requestAnimationFrame(() => {
        if (autoFollowAnswerRef.current) {
          scrollToLatestAnswer("smooth");
        }
      });
      await wait(Math.min(450, Math.max(120, chunk.length * 12)));
    }

    setAnswers((current) => [turn, ...current].slice(0, 20));
    setStreamingAnswer(null);
    window.requestAnimationFrame(() => scrollToLatestAnswer("smooth"));
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
        const parsed = messages.map(parseStoredAnswer).filter(Boolean) as Array<{ question: string; result: CaseAnswer }>;
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
      scrollToLatestAnswer("smooth");
    }
  }, [isAsking, streamingAnswer?.visibleAnswer, workStateIndex, autoFollowAnswer]);

  function handleChatScroll() {
    const container = chatScrollRef.current;
    if (!container || (!isAsking && !streamingAnswer)) {
      return;
    }

    updateAutoFollowAnswer(isNearBottom(container, 140));
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
    const resolvedAction = selectedAction || resolveSuggestedActionReply(cleanQuestion, latestSuggestedActions);
    const displayQuestion = resolvedAction?.label || cleanQuestion;
    const retrievalQuestion = resolvedAction?.queryTemplate || cleanQuestion;
    const activeMode = resolvedAction?.intent || inferCollaborationModeFromText(cleanQuestion);

    if (!displayQuestion) {
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
        const stored = parseStoredAnswer(persisted);
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
    try {
      const providerMessage = await askCaseAi({
        caseId: selectedCase.id,
        question: retrievalQuestion,
        coverage,
        pendingOcrPages,
        deviations,
        nextActionTitle
      });
      const providerAnswer = parseStoredAnswer(providerMessage);
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
    } finally {
      setIsAsking(false);
    }

    setIsAsking(true);
    const localTurnId = `local-${Date.now()}`;
    const nextSuggestedActions = createDefaultSuggestedActions(localTurnId);
    const result = {
      ...buildAnswer(retrievalQuestion, sources, coverage, deviations, pendingOcrPages, nextActionTitle),
      suggestedActions: nextSuggestedActions
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
    const stored = parseStoredAnswer(persisted);
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
          <div className="case-summary-card">
            <div className="mode-line">
              <span className="local-pill">Sikker lokalmodus</span>
              <span>Ekstern AI er av. Svar bygger kun på lokale kilder i saken.</span>
              <span className="case-mode-chip">Arbeidsmodus: {COLLABORATION_MODE_LABELS[activeCollaborationMode]}</span>
              <button type="button" className="button-ghost control-status-link" onClick={onOpenControl}>
                Vis kontrollstatus
              </button>
            </div>
            {isCaseSummaryReady ? (
              <div className="case-summary-sections">
                <h3>{coverage >= 95 ? "Saksoppsummering" : "Foreløpig saksoppsummering"}</h3>
                <section>
                  <h4>Kort fortalt</h4>
                  <p>{caseSummary.short}</p>
                </section>
                <section>
                  <h4>Viktigste punkter</h4>
                  <ul>
                    {caseSummary.keyPoints.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </section>
                <section>
                  <h4>Sentrale aktører</h4>
                  <ul>
                    {caseSummary.actors.map((actor) => (
                      <li key={actor}>{actor}</li>
                    ))}
                  </ul>
                </section>
                <section>
                  <h4>Mulige hovedspor</h4>
                  <ul>
                    {caseSummary.tracks.map((track) => (
                      <li key={track}>{track}</li>
                    ))}
                  </ul>
                </section>
                <section>
                  <h4>Usikkerhet / må kontrolleres</h4>
                  <ul>
                    {caseSummary.uncertainty.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
                <section>
                  <h4>Anbefalte neste steg</h4>
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
            <article className="case-system-card" aria-live="polite">
              <h3>{isImporting ? "Saken klargjøres" : "Dokumenter mottatt"}</h3>
              <p>
                {isImporting
                  ? "Evida leser dokumentene og lager sporbare kilder automatisk."
                  : `Evida har mottatt ${importQueue.length} dokumenter og behandler dem automatisk. Du trenger ikke gjøre noe.`}
              </p>
              <div className="case-live-progress" aria-label={`Dokumentbehandling ${liveImportProgress} prosent`}>
                <div className="case-live-progress__track">
                  <div className="case-live-progress__bar" style={{ width: `${liveImportProgress}%` }} />
                </div>
                <strong>{liveImportProgress}%</strong>
              </div>
              <div className="case-intake-steps" aria-live="polite">
                {intakeWorkState.states.map((state, index) => (
                  <span key={state} className={index === intakeWorkState.activeIndex && isImporting ? "is-active" : undefined}>
                    {state}
                  </span>
                ))}
              </div>
              <div className="case-intake-grid">
                <span>Dokumenter</span>
                <strong>{readyImportItems.length}/{importQueue.length || documents.length}</strong>
                <span>Sider</span>
                <strong>{documents.reduce((sum, document) => sum + (document.analyzed_page_count || 0), 0)}/{totalPages || importPages || "beregnes"}</strong>
                <span>Kildedekning</span>
                <strong>{Math.round(intakeCoverage)} %</strong>
                <span>Nåværende steg</span>
                <strong>{intakeStepLabel(activeImportItem)}</strong>
                <span>Estimert tid</span>
                <strong>{importEta(activeImportItem, importNow)}</strong>
              </div>
              {importQueue.length > 0 ? (
                <div className="case-import-file-list">
                  {importQueue.map((item) => (
                    <div key={item.path} className={`case-import-file case-import-file--${item.status}`}>
                      <span className="case-import-file__pulse" aria-hidden="true" />
                      <div>
                        <strong>{item.name}</strong>
                        <span>{item.detail}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
              {isImporting ? <p className="muted">Store eller skannede dokumenter kan ta litt tid.</p> : null}
            </article>
          ) : null}
          {shouldShowNamingCard ? (
            <article className="case-system-card case-naming-card">
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
              <h3>{!hasDocuments ? "Start med dokumentene" : isBlocked || sourceCoverageTooLow ? "Saken klargjøres" : "Spør saken"}</h3>
              <p>
                {!hasDocuments
                  ? "Dra dokumenter hit, eller trykk + ved meldingsfeltet for å laste opp. Evida leser dokumentene, lager sporbare kilder og viser en saksoppsummering når grunnlaget er klart."
                  : isBlocked || sourceCoverageTooLow
                  ? "Evida lager sporbare kilder automatisk. Saksrom åpnes når dokumentgrunnlaget er klart."
                  : "Still spørsmål om dokumentene. Svar viser kilder, usikkerhet og hva som mangler."}
              </p>
              {!hasDocuments ? (
                <button type="button" className="button-primary" onClick={onChooseDocuments}>
                  Velg dokumenter
                </button>
              ) : null}
              {hasDocuments && !sourceCoverageTooLow && suggestedQuestions.length > 0 ? (
                <div className="suggested-question-list suggested-question-list--centered">
                  {suggestedQuestions.map((suggestion) => (
                    <button key={suggestion} type="button" className="button-ghost" onClick={() => setQuestion(suggestion)}>
                      {suggestion}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            visibleAnswers.map((entry, index) => (
              <article key={`${entry.question}-${index}`} className="case-message-group">
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
            <article className="case-message-group">
              <div className="case-message case-message--user">{streamingAnswer.question}</div>
              <div className="case-message case-message--assistant case-message--streaming">
                <div className="case-answer-body">{streamingAnswer.visibleAnswer}</div>
              </div>
            </article>
          ) : null}
          {providerNotice ? <div className="case-provider-notice">{providerNotice}</div> : null}
          {isAsking && !streamingAnswer && workstyle.showDetailedWorkStates ? (
            <div className="case-work-states" role="status" aria-live="polite" aria-label="Evida arbeider">
              {SAKSROM_WORK_STATES.map((state, index) => (
                <span key={state} className={index <= workStateIndex ? "is-active" : undefined}>
                  {state}
                </span>
              ))}
            </div>
          ) : null}
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

      <form
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
                : "Spør fritt, velg et spor, eller skriv 1–4"
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
