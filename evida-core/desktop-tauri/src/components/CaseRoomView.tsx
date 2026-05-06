import { useEffect, useState } from "react";
import type { CaseAiMessageDto, CaseSummary, DocumentSummary, SourceObjectSummary } from "../types";
import { listCaseAiMessages, recordCaseAiExchange } from "../lib/api";

interface CaseRoomViewProps {
  selectedCase?: CaseSummary;
  documents: DocumentSummary[];
  sources: SourceObjectSummary[];
  sourcesById: Map<string, SourceObjectSummary>;
  pendingOcrPages: number;
  coverage: number;
  deviations: string[];
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
      answer: "AI-provider ikke aktivert. Lokal kildebasert fallback fant ingen sporbare kildeutdrag å svare fra.",
      sourceIds: [],
      validatedSources: [],
      answerStrength: {
        level: "Lav",
        reason: "Svaret bygger på 0 kildeutdrag."
      },
      uncertainty: "Høy. Saken mangler kildegrunnlag.",
      missing: "Importer dokumenter, kjør OCR eller oppdater kildeutdrag.",
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
    answer: `AI-provider ikke aktivert. Lokal kildebasert fallback peker foreløpig på dette: ${answerSentences.join(" ")}`,
    sourceIds: selected.map((source) => source.id),
    validatedSources: selected.map((source) => ({
      sourceId: source.id,
      documentId: source.document_id,
      pageNumber: source.page_start,
      validationStatus: "LOCAL"
    })),
    answerStrength: {
      level: selected.length >= 4 && coverage >= 80 && pendingOcrPages === 0 ? "Høy" : selected.length >= 2 ? "Middels" : "Lav",
      reason: `Svaret bygger på ${selected.length} kildeutdrag fra lokal fallback.`
    },
    uncertainty:
      coverage < 80 || pendingOcrPages > 0
        ? "Middels til høy. Dokumentdekning eller OCR er ikke komplett."
        : "Middels. Svaret er extractive og må vurderes faglig.",
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

export function CaseRoomView({
  selectedCase,
  documents,
  sources,
  sourcesById,
  pendingOcrPages,
  coverage,
  deviations,
  nextActionTitle,
  onOpenSource,
  onOpenControl
}: CaseRoomViewProps) {
  const [question, setQuestion] = useState("");
  const [answers, setAnswers] = useState<Array<{ question: string; result: CaseAnswer }>>([]);
  const hasSources = sources.length > 0;
  const hasDocuments = documents.length > 0;
  const totalPages = documents.reduce((sum, document) => sum + document.page_count, 0);
  const processedDocuments = documents.filter((document) => document.source_count > 0 || document.analyzed_page_count > 0);
  const canAsk = Boolean(selectedCase?.id && hasDocuments);
  const isIncomplete = !hasSources || coverage < 95 || pendingOcrPages > 0 || deviations.length > 0;
  const summary = hasSources
    ? `${selectedCase?.name || "Valgt sak"} har et foreløpig kildebasert grunnlag. Still spørsmål til saken, og Saksrom svarer med kilder, usikkerhet og hva som mangler.`
    : hasDocuments
      ? `${selectedCase?.name || "Valgt sak"} har dokumenter, men mangler foreløpig sporbare kildeutdrag. Saksrom kan fortsatt svare, men grunnlaget bør kontrolleres.`
      : "Importer dokumenter først. Saksrom blir samtaleflaten for oppsummering og spørsmål når saken har dokumentgrunnlag.";
  const summaryIntro = hasDocuments
    ? "Jeg har gått gjennom dokumentene som er ferdig behandlet og laget en foreløpig saksoversikt."
    : summary;
  const summaryLines = hasDocuments
    ? [
        `Dokumentgrunnlag: ${documents.length} dokumenter, ${totalPages} PDF-sider og ${processedDocuments.length} dokumenter ferdig behandlet.`,
        hasSources
          ? `Sporbare kilder: ${sources.length} kildeutdrag er klare for spørsmål og kontroll.`
          : "Sporbare kilder: mangler foreløpig. Svar merkes derfor som usikre eller uten kilde.",
        pendingOcrPages > 0
          ? `Åpne punkter: ${pendingOcrPages} sider trenger OCR eller tekstkontroll.`
          : "Åpne punkter: ingen OCR-ventende sider registrert i denne visningen.",
        "Arbeidsmåte: spør saken, og hvert svar viser kilder, usikkerhet, mangler og neste steg."
      ]
    : [];
  const suggestedQuestions = [
    "Hva handler saken om?",
    "Hva er dokumentert?",
    "Hva mangler?",
    "Hva bør kontrolleres først?"
  ];
  const visibleAnswers = [...answers].reverse();

  useEffect(() => {
    if (!selectedCase?.id) {
      setAnswers([]);
      return;
    }
    listCaseAiMessages(selectedCase.id)
      .then((messages) => setAnswers(messages.map(parseStoredAnswer).filter(Boolean) as Array<{ question: string; result: CaseAnswer }>))
      .catch(() => setAnswers([]));
  }, [selectedCase?.id]);

  async function askCase() {
    const cleanQuestion = question.trim();
    if (!cleanQuestion || !selectedCase?.id || !canAsk) {
      return;
    }
    const result = buildAnswer(cleanQuestion, sources, coverage, deviations, pendingOcrPages, nextActionTitle);
    const answerJson = JSON.stringify({
      question: cleanQuestion,
      result,
      model_id: "local-source-fallback",
      prompt_version: "case_room_fallback_v1",
      source_index_version: `sources-${sources.length}`
    });
    const persisted = await recordCaseAiExchange({
      caseId: selectedCase.id,
      question: cleanQuestion,
      answerJson,
      sourceIds: result.sourceIds,
      modelId: "local-source-fallback",
      promptVersion: "case_room_fallback_v1",
      sourceIndexVersion: `sources-${sources.length}`
    });
    const stored = parseStoredAnswer(persisted);
    setAnswers((current) => [stored || { question: cleanQuestion, result }, ...current].slice(0, 20));
    setQuestion("");
  }

  return (
    <section className="case-chat-shell">
      <div className="case-chat-scroll">
        <header className="case-chat-header">
          <p className="eyebrow">Saksrom</p>
          <h2>{selectedCase?.name || "Valgt sak"}</h2>
          <div className="case-summary-card">
            <h3>Oppsummering</h3>
            <p>{summaryIntro}</p>
            {summaryLines.length > 0 ? (
              <ul className="case-summary-list">
                {summaryLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : null}
            {isIncomplete ? (
              <div className="case-soft-warning">
                <span>Dokumentgrunnlaget er ikke komplett. Svar kan være ufullstendige.</span>
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
              <h3>Spør saken</h3>
              <p>Still spørsmål om dokumentene. Svar viser kilder, usikkerhet og hva som mangler.</p>
              <div className="suggested-question-list suggested-question-list--centered">
                {suggestedQuestions.map((suggestion) => (
                  <button key={suggestion} type="button" className="button-ghost" onClick={() => setQuestion(suggestion)}>
                    {suggestion}
                  </button>
                ))}
              </div>
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
                </div>
              </article>
            ))
          )}
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
          placeholder="Still et spørsmål om saken"
          rows={1}
          disabled={!canAsk}
        />
        <button type="submit" className="button-primary" disabled={!question.trim() || !selectedCase?.id || !canAsk}>
          Send
        </button>
      </form>
    </section>
  );
}
