import type { SourceObjectSummary } from "../../types";
import { EmptyStateAction } from "../EmptyStateAction";
import { sourceTitle } from "./SourceButtonList";
import type { ConflictRow } from "./types";

interface ContradictionsViewProps {
  rows: ConflictRow[];
  sourcesById: Map<string, SourceObjectSummary>;
  onFind: () => void;
  onOpenSource: (sourceId: string) => void;
}

export function ContradictionsView({
  rows,
  sourcesById,
  onFind,
  onOpenSource
}: ContradictionsViewProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Motstrid</h2>
          <p>Mulige avvik mellom kilder, med tema, betydning og status.</p>
        </div>
        <button onClick={onFind}>Finn motstrid</button>
      </div>
      {rows.length === 0 ? (
        <EmptyStateAction
          title="Motstridsanalyse ikke kjørt."
          description="Siden viser konflikter når analyse er startet."
          actionLabel="Finn motstrid"
          onAction={onFind}
        />
      ) : (
        <div className="work-table contradictions-table">
          <div>Tema</div>
          <div>Kilde A</div>
          <div>Kilde B</div>
          <div>Konflikt</div>
          <div>Betydning</div>
          <div>Status</div>
          {rows.map((row) => (
            <div className="work-row" key={row.id}>
              <strong>{row.topic}</strong>
              <button className="link-button" onClick={() => onOpenSource(row.sourceA)}>
                {sourceTitle(sourcesById.get(row.sourceA))}
              </button>
              <button className="link-button" onClick={() => onOpenSource(row.sourceB)}>
                {sourceTitle(sourcesById.get(row.sourceB))}
              </button>
              <span>{row.conflict}</span>
              <span>{row.significance}</span>
              <span>{row.status}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
