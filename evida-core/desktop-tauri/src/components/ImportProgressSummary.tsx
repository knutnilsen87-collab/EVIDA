import type { ImportProgressPhase, ImportProgressState } from "../features/documents/importUx";
import { formatEtaLabel } from "../features/documents/importUx";

export interface ImportAttentionItem {
  id: string;
  documentId?: string;
  name: string;
  problem: string;
  suggestedAction: string;
  status?: string;
  canApprove?: boolean;
  approvalChecked?: boolean;
  sourceCount?: number;
  approvalState?: "idle" | "saving" | "approved";
}

interface ImportProgressSummaryProps {
  totalDocuments: number;
  importedDocuments?: number;
  processedDocuments?: number;
  terminalDocuments: number;
  processingDocuments: number;
  remainingDocuments: number;
  failedDocuments: number;
  attentionDocuments: number;
  skippedDocuments: number;
  totalBytes?: number;
  uploadedBytes?: number;
  processedPages?: number;
  totalPagesEstimate?: number;
  sourcesCreated?: number;
  currentPhase: ImportProgressPhase;
  currentPhaseLabel: string;
  progressPercent: number;
  startedAt?: number | null;
  etaSeconds: number | null;
  isImporting: boolean;
  state: ImportProgressState;
  title: string;
  statusMessage?: string;
  attentionItems: ImportAttentionItem[];
  failedItems: ImportAttentionItem[];
  detailsOpen?: boolean;
  onShowAttentionItems?: () => void;
  onShowDetails?: () => void;
  onOpenAttentionItem?: (item: ImportAttentionItem) => void;
  onApproveAttentionItem?: (item: ImportAttentionItem) => void;
}

export function ImportProgressSummary({
  totalDocuments,
  importedDocuments,
  processedDocuments,
  terminalDocuments,
  processingDocuments,
  remainingDocuments,
  failedDocuments,
  attentionDocuments,
  skippedDocuments,
  processedPages,
  totalPagesEstimate,
  sourcesCreated,
  currentPhaseLabel,
  progressPercent,
  etaSeconds,
  isImporting,
  state,
  title,
  statusMessage,
  attentionItems,
  failedItems,
  detailsOpen = false,
  onShowAttentionItems,
  onShowDetails,
  onOpenAttentionItem,
  onApproveAttentionItem
}: ImportProgressSummaryProps) {
  const doneCount = processedDocuments ?? terminalDocuments;
  const selectedText = `${totalDocuments} ${totalDocuments === 1 ? "dokument valgt" : "dokumenter valgt"}`;
  const attentionCount = attentionDocuments + failedDocuments;
  const itemsForDetails = [...attentionItems, ...failedItems.filter((item) => !attentionItems.some((candidate) => candidate.id === item.id))];
  const isComplete = state === "complete";
  const isAttentionState = state === "complete_with_attention" || state === "complete_with_errors";
  const safeProgress = Math.max(0, Math.min(100, progressPercent));
  const showEta = state === "processing" && (remainingDocuments > 0 || processingDocuments > 0);
  const etaLabel = formatEtaLabel(etaSeconds);
  const etaPrimary = etaSeconds === null ? "Beregner tid igjen" : etaLabel.replace(/^ETA:\s*/, "");
  const remainingLabel = `${remainingDocuments} ${remainingDocuments === 1 ? "dokument gjenstår" : "dokumenter gjenstår"}`;
  const activeLabel = `${processingDocuments} ${processingDocuments === 1 ? "behandles nå" : "behandles nå"}`;

  return (
    <section className={`import-progress-summary import-progress-summary--${state}`} aria-live="polite">
      <div className="import-progress-summary__header">
        <div>
          <div className="eyebrow">{isImporting || state === "processing" ? "Import pågår" : "Importstatus"}</div>
          <h2>{title}</h2>
          <p>{selectedText}</p>
        </div>
        <span className={`status-chip ${isComplete ? "status-chip--ok" : isAttentionState ? "status-chip--warn" : ""}`}>
          {state === "processing"
            ? "Behandles"
            : state === "complete"
              ? "Fullført"
              : state === "complete_with_errors"
                ? "Feil"
                : "Kontroll kreves"}
        </span>
      </div>

      <div className="import-progress-summary__bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={safeProgress}>
        <span style={{ width: `${safeProgress}%` }} />
      </div>

      <div className="import-progress-summary__primary">
        <strong>{doneCount} av {totalDocuments} dokumenter behandlet</strong>
        <span>{showEta ? etaLabel : remainingLabel}</span>
      </div>

      {showEta ? (
        <div className="import-progress-summary__eta" aria-label={`Estimert tid igjen: ${etaPrimary}`}>
          <span>Estimert tid igjen</span>
          <strong>{etaPrimary}</strong>
          <small>{remainingLabel} · {activeLabel} · {currentPhaseLabel}</small>
        </div>
      ) : null}

      <div className="import-progress-summary__grid">
        <span>Fremdrift</span>
        <strong>{safeProgress} %</strong>
        <span>Fase</span>
        <strong>{currentPhaseLabel}</strong>
        {showEta ? (
          <>
            <span>ETA</span>
            <strong>{etaLabel}</strong>
          </>
        ) : null}
        <span>Importert</span>
        <strong>{importedDocuments ?? terminalDocuments} av {totalDocuments}</strong>
        <span>Behandles nå</span>
        <strong>{processingDocuments}</strong>
        <span>Krever kontroll</span>
        <strong>{attentionCount}</strong>
        {typeof processedPages === "number" || typeof totalPagesEstimate === "number" ? (
          <>
            <span>Sider</span>
            <strong>{processedPages ?? 0} av {totalPagesEstimate ?? 0}</strong>
          </>
        ) : null}
        {typeof sourcesCreated === "number" ? (
          <>
            <span>Kildeutdrag</span>
            <strong>{sourcesCreated}</strong>
          </>
        ) : null}
        {skippedDocuments > 0 ? (
          <>
            <span>Ikke importert på nytt</span>
            <strong>{skippedDocuments}</strong>
          </>
        ) : null}
      </div>

      {statusMessage ? <p className="import-progress-summary__message">{statusMessage}</p> : null}
      {state === "processing" ? (
        <p className="import-progress-summary__reassurance">
          Du kan fortsette å jobbe. Evida sier fra hvis noe trenger manuell kontroll.
        </p>
      ) : null}

      {state === "complete" ? (
        <div className="import-progress-summary__success">
          <strong>Import fullført</strong>
          <span>{totalDocuments} dokumenter behandlet</span>
          {typeof processedPages === "number" ? <span>{processedPages} sider analysert</span> : null}
          {typeof sourcesCreated === "number" ? <span>{sourcesCreated} kildeutdrag opprettet</span> : null}
          <span>0 dokumenter krever manuell kontroll</span>
        </div>
      ) : null}

      {isAttentionState ? (
        <div className="import-progress-summary__warning" role="alert">
          {attentionDocuments > 0 ? (
            <p>{attentionDocuments} {attentionDocuments === 1 ? "dokument trenger" : "dokumenter trenger"} manuell kontroll før de kan brukes som kildegrunnlag.</p>
          ) : null}
          {failedDocuments > 0 ? (
            <p>{failedDocuments} {failedDocuments === 1 ? "dokument ble ikke brukt" : "dokumenter ble ikke brukt"} som kildegrunnlag.</p>
          ) : null}
        </div>
      ) : null}

      {attentionCount > 0 ? (
        <div className="import-progress-summary__actions">
          {onShowAttentionItems ? (
            <button className="button-primary" type="button" aria-controls="documents-needing-control" onClick={onShowAttentionItems}>
              Start kontroll
            </button>
          ) : null}
          {onShowDetails ? (
            <button className="button-secondary" type="button" onClick={onShowDetails}>
              {detailsOpen ? "Skjul detaljer" : "Vis detaljer"}
            </button>
          ) : null}
        </div>
      ) : null}

      {detailsOpen && itemsForDetails.length > 0 ? (
        <section className="import-progress-summary__attention-list" aria-label="Dokumenter som krever kontroll">
          <h3>Dokumenter som krever kontroll</h3>
          {itemsForDetails.map((item) => (
            <article key={item.id} className="import-progress-summary__attention-row">
              <div>
                <strong>{item.name}</strong>
                <span>{item.problem}</span>
                <small>{item.suggestedAction}</small>
              </div>
              <div className="panel-actions">
                {onOpenAttentionItem ? (
                  <button className="button-secondary" type="button" onClick={() => onOpenAttentionItem(item)}>
                    Åpne preview
                  </button>
                ) : null}
                {item.canApprove && onApproveAttentionItem ? (
                  <button
                    className="button-primary"
                    type="button"
                    disabled={!item.approvalChecked || item.approvalState === "saving" || item.approvalState === "approved"}
                    onClick={() => onApproveAttentionItem(item)}
                  >
                    {item.approvalState === "saving"
                      ? "Lagrer ..."
                      : item.approvalState === "approved"
                        ? "Kontrollert"
                        : item.sourceCount && item.sourceCount > 0
                          ? "Bruk som kildegrunnlag"
                          : "Marker som kontrollert"}
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </section>
      ) : null}
    </section>
  );
}
