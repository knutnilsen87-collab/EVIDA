import type { SourceObjectSummary } from "../../types";
import { EmptyStateAction } from "../EmptyStateAction";
import { SourceButtonList } from "./SourceButtonList";
import type { EvidenceRow } from "./types";

interface EvidenceViewProps {
  rows: EvidenceRow[];
  sourcesById: Map<string, SourceObjectSummary>;
  onBuild: () => void;
  onOpenSource: (sourceId: string) => void;
}

export function EvidenceView({ rows, sourcesById, onBuild, onOpenSource }: EvidenceViewProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Bevismatrise</h2>
          <p>Påstander koblet til støttende og svekkende kilder.</p>
        </div>
        <button className="button-primary" onClick={onBuild}>Bygg bevismatrise</button>
      </div>
      {rows.length === 0 ? (
        <EmptyStateAction
          title="Ingen bevismatrise bygget ennå."
          description="Bevis viser p\u00e5standsobjekter, ikke en liste med r\u00e5 tekstutdrag."
          actionLabel="Bygg bevismatrise"
          onAction={onBuild}
        />
      ) : (
        <div className="work-table evidence-table">
          <div>Påstand</div>
          <div>Støttende kilder</div>
          <div>Svekkende kilder</div>
          <div>Bevisstyrke</div>
          <div>Status</div>
          {rows.map((row) => (
            <div className="work-row" key={row.id}>
              <strong>{row.claim}</strong>
              <SourceButtonList ids={row.supporting} sourcesById={sourcesById} onOpenSource={onOpenSource} />
              <SourceButtonList ids={row.weakening} sourcesById={sourcesById} onOpenSource={onOpenSource} />
              <span>{row.strength}</span>
              <span>{row.status}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
