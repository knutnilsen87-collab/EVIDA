import { useEffect, useMemo, useState } from "react";
import type { CaseAiMessageDto, CaseSummary, DocumentSummary, SourceObjectSummary } from "../types";
import type { EvidenceRow, TimelineItem } from "./workrooms/types";
import { NextAction } from "./NextAction";
import { listCaseAiMessages, recordCaseAiExchange } from "../lib/api";

interface CaseRoomNextAction {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  step?: number;
  stepTotal?: number;
  why?: string;
  secondaryLabel?: string;
  onSecondaryAction?: () => void;
}

interface CaseRoomViewProps {
  selectedCase?: CaseSummary;
  documents: DocumentSummary[];
  sources: SourceObjectSummary[];
  sourcesById: Map<string, SourceObjectSummary>;
  timelineItems: TimelineItem[];
  evidenceRows: EvidenceRow[];
  totalPages: number;
  analyzedPages: number;
  pendingOcrPages: number;
  ocrStatus: string;
  coverage: number;
  deviations: string[];
  nextAction: CaseRoomNextAction;
  onOpenSource: (sourceId: string) => void;
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

const topicDefinitions = [
  { label: "Økonomiske transaksjoner", keywords: ["betaling", "faktura", "transaksjon", "beløp", "bank", "konto"] },
  { label: "E-postkommunikasjon", keywords: ["epost", "e-post", "mail", "melding", "korrespondanse"] },
  { label: "Regnskapsavvik", keywords: ["regnskap", "avvik", "bilag", "bokført", "balanse", "revisjon"] },
  { label: "Selskapsstruktur", keywords: ["selskap", "styre", "aksje", "eier", "organisasjon", "konsern"] },
  { label: "Vitneforklaringer", keywords: ["vitne", "forklaring", "uttalelse", "intervju", "forklarte"] },
  { label: "Tekniske spor", keywords: ["logg", "ip", "system", "metadata", "fil", "teknisk"] }
];

function countLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function firstSentence(value: string) {
  const sentence = value.split(/[.!?]\s/)[0] || value;
  return sentence.length > 170 ? `${sentence.slice(0, 167)}...` : sentence;
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

function buildKeyPoints(sources: SourceObjectSummary[], hasSources: boolean) {
  if (!hasSources) {
    return [
      { text: "Saken har foreløpig ikke sporbare kildeutdrag.", basis: "Mangler kilde" },
      { text: "Importer dokumenter eller kontroller OCR før saksrommet kan gi kildebasert innhold.", basis: "Foreløpig" }
    ];
  }

  return sources.slice(0, 6).map((source) => ({
    text: firstSentence(source.text_excerpt),
    basis: `${source.document_id} side ${source.page_start}`
  }));
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
        reason: "Svaret bygger på 0 kildeobjekter."
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
      reason: `Svaret bygger på ${selected.length} kildeobjekter fra lokal fallback. Dokumentdekning er ${coverage}%.`
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
  timelineItems,
  evidenceRows,
  totalPages,
  analyzedPages,
  pendingOcrPages,
  ocrStatus,
  coverage,
  deviations,
  nextAction,
  onOpenSource
}: CaseRoomViewProps) {
  const [question, setQuestion] = useState("");
  const [answers, setAnswers] = useState<Array<{ question: string; result: CaseAnswer }>>([]);
  const hasSources = sources.length > 0;
  const keyPoints = useMemo(() => buildKeyPoints(sources, hasSources), [hasSources, sources]);
  const topics = useMemo(() => {
    const text = sources.map((source) => source.text_excerpt.toLowerCase()).join(" ");
    return topicDefinitions
      .map((topic) => ({
        label: topic.label,
        confidence: topic.keywords.filter((keyword) => text.includes(keyword)).length
      }))
      .filter((topic) => topic.confidence > 0)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 6);
  }, [sources]);
  const summary = hasSources
    ? `${selectedCase?.name || "Valgt sak"} har ${countLabel(documents.length, "dokument", "dokumenter")} og ${countLabel(sources.length, "kildeobjekt", "kildeobjekter")} klare for foreløpig saksarbeid. ${timelineItems.length > 0 ? "Kronologi er bygget." : "Kronologi er ikke bygget ennå."} ${evidenceRows.length > 0 ? "Bevismatrise finnes." : "Bevismatrise mangler."}`
    : `${selectedCase?.name || "Valgt sak"} mangler foreløpig sporbare kildeutdrag. Saksrommet kan derfor bare vise status og anbefalt neste handling.`;

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
    if (!cleanQuestion || !selectedCase?.id) {
      return;
    }
    const result = buildAnswer(cleanQuestion, sources, coverage, deviations, pendingOcrPages, nextAction.title);
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
    setAnswers((current) => [stored || { question: cleanQuestion, result }, ...current].slice(0, 5));
    setQuestion("");
  }

  return (
    <div className="case-room">
      <section className="panel case-room-summary">
        <div className="panel-header">
          <div>
            <h2>Sakssammendrag</h2>
            <p>Oversikt og spørsmålsflate. Råkilder åpnes kun ved klikk.</p>
          </div>
        </div>
        <p className="case-room-lead">{summary}</p>
        <div className="case-room-status">
          <span>Kildestatus: <strong>{hasSources ? "Kildebasert grunnlag finnes" : "Mangler kildegrunnlag"}</strong></span>
          <span>Usikkerhet: <strong>{coverage < 80 || pendingOcrPages > 0 ? "middels/høy" : "middels"}</strong></span>
          <span>Dekning: <strong>{coverage}%</strong></span>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Nøkkelpunkter</h2>
            <p>4-7 foreløpige punkter basert på tilgjengelige kildeutdrag.</p>
          </div>
        </div>
        <div className="key-point-list">
          {keyPoints.map((point) => (
            <article key={`${point.basis}-${point.text}`} className="key-point">
              <strong>{point.text}</strong>
              <span>{point.basis}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Dokumentert så langt</h2>
            <p>Status for hva som kan brukes som kildegrunnlag.</p>
          </div>
        </div>
        <div className="case-room-metrics">
          <span>Dokumenter <strong>{documents.length}</strong></span>
          <span>PDF-sider <strong>{totalPages}</strong></span>
          <span>Analyserte sider <strong>{analyzedPages}</strong></span>
          <span>Kildeobjekter <strong>{sources.length}</strong></span>
          <span>OCR-status <strong>{pendingOcrPages > 0 ? `${pendingOcrPages} sider venter` : ocrStatus}</strong></span>
          <span>Dokumentdekning <strong>{coverage}%</strong></span>
          <span>Avvik <strong>{deviations.length}</strong></span>
        </div>
        {deviations.length > 0 ? <div className="warning-notice">{deviations.join(" ")}</div> : null}
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Mulige temaer</h2>
            <p>Heuristisk keyword extraction for MVP.</p>
          </div>
        </div>
        <div className="topic-chip-list">
          {(topics.length > 0 ? topics : topicDefinitions.slice(0, 4).map((topic) => ({ label: topic.label, confidence: 0 }))).map((topic) => (
            <span key={topic.label} className={topic.confidence > 0 ? "topic-chip" : "topic-chip topic-chip--tentative"}>
              {topic.label}
              <small>{topic.confidence > 0 ? "kildebasert" : "foreløpig"}</small>
            </span>
          ))}
        </div>
      </section>

      <NextAction {...nextAction} />

      <section className="panel ask-case-panel">
        <div className="panel-header">
          <div>
            <h2>Spør saken</h2>
            <p>Lokal kildebasert fallback brukes når AI-provider ikke er aktivert.</p>
          </div>
        </div>
        <div className="ask-case-form">
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void askCase();
              }
            }}
            placeholder="Still et spørsmål om valgt sak"
          />
          <button className="button-primary" onClick={() => void askCase()}>Spør saken</button>
        </div>
        {answers.length === 0 ? (
          <div className="empty-state">Ingen spørsmål stilt ennå. Svar vil vise svar, kilder, usikkerhet, mangler og neste steg.</div>
        ) : (
          <div className="case-answer-list">
            {answers.map((entry, index) => (
              <article key={`${entry.question}-${index}`} className="case-answer">
                <h3>{entry.question}</h3>
                <div>
                  <strong>Svar</strong>
                  <p>{entry.result.answer}</p>
                </div>
                <div>
                  <strong>Kilder</strong>
                  {entry.result.validatedSources.length > 0 ? (
                    <div className="case-source-card-list">
                      {entry.result.validatedSources.map((sourceRef) => {
                        const source = sourcesById.get(sourceRef.sourceId);
                        return (
                          <article key={sourceRef.sourceId} className="case-source-card">
                            <div>
                              <strong>{sourceRef.documentId} · side {sourceRef.pageNumber || "?"}</strong>
                              <span>{sourceRef.sourceId} · validering {sourceRef.validationStatus}</span>
                            </div>
                            <p>{source ? firstSentence(source.text_excerpt) : "Kilde mangler i lokal indeks."}</p>
                            <button className="button-secondary" onClick={() => onOpenSource(sourceRef.sourceId)}>Åpne kilde</button>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <span className="muted">Mangler kilde</span>
                  )}
                </div>
                <div className="case-answer-grid">
                  <span><strong>Svarstyrke</strong>{entry.result.answerStrength.level}: {entry.result.answerStrength.reason}</span>
                  <span><strong>Usikkerhet</strong>{entry.result.uncertainty}</span>
                  <span><strong>Hva mangler</strong>{entry.result.missing}</span>
                  <span><strong>Neste steg</strong>{entry.result.nextStep}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
