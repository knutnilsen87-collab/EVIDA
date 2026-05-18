import type { CasePreparationProgress as CasePreparationProgressData } from "../features/casePreparation/casePreparation.types";

interface CasePreparationProgressProps {
  progress: CasePreparationProgressData;
  onOpenControl: () => void;
}

export function CasePreparationProgress({ progress, onOpenControl }: CasePreparationProgressProps) {
  const scopeLabel =
    progress.saksromScope === "full_case_sources"
      ? "Fullt kildegrunnlag"
      : progress.saksromScope === "controlled_sources_only"
        ? "Kontrollerte kilder"
        : "Krever kilder";

  return (
    <article className={`case-preparation-progress case-preparation-progress--${progress.phase}`} data-testid="case-preparation-progress" aria-live="polite">
      <div className="case-preparation-progress__header">
        <div>
          <div className="eyebrow">Fremdrift</div>
          <h3>{progress.currentPhaseLabel}</h3>
        </div>
        <strong>{progress.progressPercent} %</strong>
      </div>
      <div className="case-live-progress" aria-label={`Saksforberedelse ${progress.progressPercent} prosent`}>
        <div className="case-live-progress__track">
          <div className="case-live-progress__bar" style={{ width: `${progress.progressPercent}%` }} />
        </div>
        <span>{progress.etaLabel}</span>
      </div>
      <dl className="case-preparation-progress__grid">
        <div>
          <dt>Dokumenter</dt>
          <dd>{progress.processedDocuments}/{progress.totalDocuments}</dd>
        </div>
        <div>
          <dt>Sider</dt>
          <dd>{progress.processedPages}/{progress.totalPages || progress.processedPages}</dd>
        </div>
        <div>
          <dt>Kilder</dt>
          <dd>{progress.sourceObjects}</dd>
        </div>
        <div>
          <dt>OCR</dt>
          <dd>{progress.pendingOcrPages} sider</dd>
        </div>
        <div>
          <dt>Kontroll</dt>
          <dd>{progress.reviewDocuments} igjen</dd>
        </div>
        <div>
          <dt>Saksrom</dt>
          <dd>{scopeLabel}</dd>
        </div>
      </dl>
      <div className="case-preparation-progress__action">
        <span>{progress.nextBestAction}</span>
        {progress.reviewDocuments > 0 || progress.unreadableDocuments > 0 || progress.saksromScope !== "full_case_sources" ? (
          <button type="button" className="button-secondary" onClick={onOpenControl}>
            Se kontroll
          </button>
        ) : null}
      </div>
    </article>
  );
}
