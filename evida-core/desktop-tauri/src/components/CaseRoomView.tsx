import { useEffect, useState } from "react";
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

interface CaseRoomViewProps {
  selectedCase?: CaseSummary;
  documents: DocumentSummary[];
  sources: SourceObjectSummary[];
  sourcesById: Map<string, SourceObjectSummary>;
  pendingOcrPages: number;
  coverage: number;
  deviations: string[];
  readiness: ReadinessResult;
  nextActionTitle: string;
  onOpenSource: (sourceId: string) => void;
  onOpenControl: () => void;
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
      answer: "Sikker lokalmodus fant ingen sporbare kilder å svare fra ennå.",
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
  const answerSentences = selected.map((source) => firstSentence(source.text_excerpt));

  return {
    answer: `Sikker lokalmodus finner foreløpig dette i sakens sporbare kilder: ${answerSentences.join(" ")}`,
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
  pendingOcrPages,
  coverage,
  deviations,
  readiness,
  nextActionTitle,
  onOpenSource,
  onOpenControl
}: CaseRoomViewProps) {
  const [question, setQuestion] = useState("");
  const [answers, setAnswers] = useState<Array<{ question: string; result: CaseAnswer }>>([]);
  const [isAsking, setIsAsking] = useState(false);
  const [workStateIndex, setWorkStateIndex] = useState(0);
  const [providerNotice, setProviderNotice] = useState("");
  const [latestSuggestedActions, setLatestSuggestedActions] = useState<SuggestedAction[]>([]);
  const [activeCollaborationMode, setActiveCollaborationMode] = useState<CollaborationMode>("free_question");
  const hasSources = sources.length > 0;
  const hasDocuments = documents.length > 0;
  const isBlocked = readiness.verdict === "not_ready";
  const isPreliminaryOnly = readiness.verdict === "requires_control";
  const totalPages = documents.reduce((sum, document) => sum + document.page_count, 0);
  const processedDocuments = documents.filter((document) => document.source_count > 0 || document.analyzed_page_count > 0);
  const canAsk = Boolean(selectedCase?.id && hasDocuments && hasSources && !isBlocked);
  const isIncomplete = !hasSources || coverage < 95 || pendingOcrPages > 0 || deviations.length > 0;
  const summary = isBlocked
    ? "Saken klargjøres"
    : hasDocuments
      ? isPreliminaryOnly
        ? "Foreløpig saksforståelse"
        : "Foreløpig analyse — kontroller mot kildene"
      : "Importer dokumenter først. Saksrom blir samtaleflaten for oppsummering og spørsmål når saken har dokumentgrunnlag.";
  const summaryLines = hasDocuments
    ? isBlocked
      ? [
          "Evida lager sporbare kilder automatisk.",
          "Du trenger ikke gjøre noe nå.",
          "Saksrom-oppsummeringen vises når dokumentgrunnlaget er klart."
        ]
      : [
          `Dokumentgrunnlag: ${documents.length} dokumenter, ${totalPages} sider og ${processedDocuments.length} dokumenter ferdig behandlet.`,
          isPreliminaryOnly
            ? "Denne vurderingen bygger bare på de sidene som er ferdig behandlet."
            : "AI-forslag må fortsatt kontrolleres og godkjennes av bruker.",
          hasSources
            ? `Sporbare kilder: ${sources.length} kilder er klare for spørsmål og kontroll.`
            : "Sporbare kilder: mangler foreløpig. Svar merkes derfor som usikre eller uten kilde.",
          pendingOcrPages > 0
            ? `Åpne punkter: ${pendingOcrPages} sider venter på tekst fra skannede sider.`
            : "Åpne punkter: ingen ventende sider registrert i denne visningen.",
          "Arbeidsmåte: spør saken, og hvert svar viser kilder, usikkerhet, mangler og neste steg."
        ]
    : [];
  const suggestedQuestions = isBlocked
    ? []
    : isPreliminaryOnly
      ? ["Hva er ferdig behandlet?", "Hva mangler?", "Hva bør kontrolleres først?"]
      : ["Hva er dokumentert?", "Hva mangler?", "Hva bør kontrolleres først?"];
  const visibleAnswers = [...answers].reverse();

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
    if (!isAsking) {
      setWorkStateIndex(0);
      return;
    }

    const timer = window.setInterval(() => {
      setWorkStateIndex((current) => Math.min(current + 1, SAKSROM_WORK_STATES.length - 1));
    }, 700);

    return () => window.clearInterval(timer);
  }, [isAsking]);

  async function askCase() {
    await submitCaseQuestion(question);
  }

  async function submitCaseQuestion(rawQuestion: string, selectedAction?: SuggestedAction) {
    const cleanQuestion = rawQuestion.trim();
    const resolvedAction = selectedAction || resolveSuggestedActionReply(cleanQuestion, latestSuggestedActions);
    const displayQuestion = resolvedAction?.label || cleanQuestion;
    const retrievalQuestion = resolvedAction?.queryTemplate || cleanQuestion;
    const activeMode = resolvedAction?.intent || inferCollaborationModeFromText(cleanQuestion);

    if (!displayQuestion || !selectedCase?.id || !canAsk) {
      return;
    }
    setActiveCollaborationMode(activeMode);
    setIsAsking(true);
    setProviderNotice("");
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
        setAnswers((current) => [answerWithActions, ...current].slice(0, 20));
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
    setAnswers((current) => [stored || { question: displayQuestion, result }, ...current].slice(0, 20));
    persistConversationTurn(result, nextSuggestedActions, activeMode, resolvedAction);
    setQuestion("");
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

  return (
    <section className="case-chat-shell">
      <div className="case-chat-scroll">
        <header className="case-chat-header">
          <p className="eyebrow">Saksrom</p>
          <h2>{selectedCase?.name || "Valgt sak"}</h2>
          <div className="case-summary-card">
            <div className="mode-line">
              <span className="local-pill">Sikker lokalmodus</span>
              <span>Ekstern AI er av. Svar bygger kun på lokale kilder i saken.</span>
              <span className="case-mode-chip">Arbeidsmodus: {COLLABORATION_MODE_LABELS[activeCollaborationMode]}</span>
            </div>
            <h3>Oppsummering</h3>
            <p>{summary}</p>
            {summaryLines.length > 0 ? (
              <ul className="case-summary-list">
                {summaryLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : null}
            {isBlocked ? (
              <div className="case-soft-warning" role="alert">
                <span>Saken klargjøres. Evida lager sporbare kilder automatisk.</span>
                <button type="button" className="button-secondary" onClick={onOpenControl}>
                  Se behandlingsstatus
                </button>
              </div>
            ) : isIncomplete ? (
              <div className="case-soft-warning">
                <span>{isPreliminaryOnly ? "Foreløpig — lav eller ufullstendig dekning." : "Dokumentgrunnlaget er ikke komplett. Svar kan være ufullstendige."}</span>
                <button type="button" className="button-secondary" onClick={onOpenControl}>
                  Se kontrollgrunnlag
                </button>
              </div>
            ) : null}
          </div>
        </header>

        <div className="case-chat-messages">
          {visibleAnswers.length === 0 ? (
            <div className="case-empty-chat">
              <h3>{isBlocked ? "Saken klargjøres" : "Spør saken"}</h3>
              <p>
                {isBlocked
                  ? "Evida lager sporbare kilder automatisk. Saksrom åpnes når dokumentgrunnlaget er klart."
                  : "Still spørsmål om dokumentene. Svar viser kilder, usikkerhet og hva som mangler."}
              </p>
              {suggestedQuestions.length > 0 ? (
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
                  <p>{entry.result.answer}</p>
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
                  {entry.result.suggestedActions?.length ? (
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
                      <span>Du kan også spørre fritt.</span>
                    </div>
                  ) : null}
                </div>
              </article>
            ))
          )}
          {providerNotice ? <div className="case-provider-notice">{providerNotice}</div> : null}
          {isAsking ? (
            <div className="case-work-states" role="status" aria-live="polite" aria-label="Evida arbeider">
              {SAKSROM_WORK_STATES.map((state, index) => (
                <span key={state} className={index <= workStateIndex ? "is-active" : undefined}>
                  {state}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <form
        className="case-chat-composer"
        onSubmit={(event) => {
          event.preventDefault();
          void askCase();
        }}
      >
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void askCase();
            }
          }}
          placeholder={isBlocked ? "Saksrom åpnes når dokumentgrunnlaget er klart" : "Spør fritt, velg et spor, eller skriv 1–4"}
          rows={1}
          disabled={!canAsk || isAsking}
          aria-disabled={!canAsk || isAsking}
        />
        <button type="submit" className="button-primary" disabled={!question.trim() || !selectedCase?.id || !canAsk || isAsking}>
          {isAsking ? "Svarer ..." : "Send"}
        </button>
      </form>
    </section>
  );
}
