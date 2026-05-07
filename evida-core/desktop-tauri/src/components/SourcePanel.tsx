import type { CaseSummary } from "../types";
import { NextAction } from "./NextAction";

interface SourcePanelProps {
  selectedCase?: CaseSummary;
  coverage: number;
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
        <div>Dekning: <strong>{coverage} % av sidene kan brukes som kilde</strong></div>
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
