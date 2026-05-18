interface ImportStatusCardProps {
  title: string;
  processedDocuments: number;
  totalDocuments: number;
  processedPages: number;
  totalPages: number;
  sourceObjects: number;
  phase: string;
  etaLabel: string;
  isActive: boolean;
  detailsOpen: boolean;
  onToggleDetails: () => void;
}

export function ImportStatusCard({
  title,
  processedDocuments,
  totalDocuments,
  processedPages,
  totalPages,
  sourceObjects,
  phase,
  etaLabel,
  isActive,
  detailsOpen,
  onToggleDetails
}: ImportStatusCardProps) {
  return (
    <div className="import-status-card" aria-live="polite">
      <div className="import-status-card__header">
        <div>
          <span className="eyebrow">{isActive ? "Saken klargjøres" : "Klargjøring ferdig"}</span>
          <h3>{title}</h3>
        </div>
        <button className="button-secondary" type="button" onClick={onToggleDetails}>
          {detailsOpen ? "Skjul detaljer" : "Vis detaljer"}
        </button>
      </div>
      <dl className="import-status-card__grid">
        <div>
          <dt>Dokumenter</dt>
          <dd>{processedDocuments} av {totalDocuments}</dd>
        </div>
        <div>
          <dt>Sider</dt>
          <dd>{processedPages} av {totalPages || processedPages}</dd>
        </div>
        <div>
          <dt>Kilder</dt>
          <dd>{sourceObjects}</dd>
        </div>
        <div>
          <dt>Fase</dt>
          <dd>{isActive ? phase : "Ferdig"}</dd>
        </div>
        {isActive ? (
          <div>
            <dt>Estimert tid</dt>
            <dd>{etaLabel}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
