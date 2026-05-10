import type { CaseSummary } from "../types";
import { NextAction } from "./NextAction";

interface SourcePanelProps {
  selectedCase?: CaseSummary;
  coverage: number;
  totalPages: number;
  processedPages: number;
  pagesWithSources: number;
  pagesMissingSources: number;
  ocrStatus: string;
  sourceCount: number;
  deviations: string[];
  nextAction: {
    title: string;
    description: string;
    actionLabel: string;
    onAction: () => void;
    step?: number;
    stepTotal?: number;
    why?: string;
    secondaryLabel?: string;
    onSecondaryAction?: () => void;
  };
}

export function SourcePanel({
  selectedCase,
  coverage,
  totalPages,
  processedPages,
  pagesWithSources,
  pagesMissingSources,
  ocrStatus,
  sourceCount,
  deviations,
  nextAction
}: SourcePanelProps) {
  return (
    <aside className="source-panel">
      <div className="panel-title">Kilde / Kontroll</div>
      <div className="source-empty">
        <strong>{selectedCase?.name || "Ingen sak valgt"}</strong>
        <span>Evaluation build · lokal behandling</span>
      </div>
      <div className="source-checklist">
        <div>Behandling: <strong>{totalPages > 0 ? `${Math.round((processedPages / totalPages) * 100)} %` : "Beregnes"}</strong></div>
        <div>Kildedekning: <strong>{coverage} % av sidene kan brukes som kilde</strong></div>
        <div>Sider med kilder: <strong>{totalPages > 0 ? `${pagesWithSources} av ${totalPages}` : "Beregnes"}</strong></div>
        <div>Sider som mangler: <strong>{totalPages > 0 ? pagesMissingSources : "Beregnes"}</strong></div>
        <div>Tekststatus: <strong>{ocrStatus}</strong></div>
        <div>Sporbare kilder: <strong>{sourceCount}</strong></div>
        <div>Avvik: <strong>{deviations.length}</strong></div>
      </div>
      {deviations.length > 0 ? (
        <div className="deviation-list">
          {deviations.slice(0, 4).map((deviation) => (
            <div key={deviation}>{deviation}</div>
          ))}
        </div>
      ) : null}
      <NextAction {...nextAction} compact />
    </aside>
  );
}
