import type { SourceObjectSummary } from "../../types";
import { EmptyStateAction } from "../EmptyStateAction";
import { SourceButtonList } from "./SourceButtonList";
import type { ArgumentRow } from "./types";

interface ArgumentsViewProps {
  rows: ArgumentRow[];
  sourcesById: Map<string, SourceObjectSummary>;
  onCreate: () => void;
  onOpenSource: (sourceId: string) => void;
}

export function ArgumentsView({ rows, sourcesById, onCreate, onOpenSource }: ArgumentsViewProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Anførselstavle</h2>
          <p>Anførsel, faktisk grunnlag, rettslig grunnlag, tilknyttede bevis og status.</p>
        </div>
        <button onClick={onCreate}>Opprett første anførsel</button>
      </div>
      {rows.length === 0 ? (
        <EmptyStateAction
          title="Ingen anførsler opprettet ennå."
          description="Opprett anførsler før de kobles mot bevis og risiko."
          actionLabel="Opprett første anførsel"
          onAction={onCreate}
        />
      ) : (
        <div className="work-table arguments-table">
          <div>Anførsel</div>
          <div>Faktisk grunnlag</div>
          <div>Rettslig grunnlag</div>
          <div>Tilknyttede bevis</div>
          <div>Status</div>
          {rows.map((row) => (
            <div className="work-row" key={row.id}>
              <strong>{row.argument}</strong>
              <span>{row.factualBasis}</span>
              <span>{row.legalBasis}</span>
              <SourceButtonList ids={row.evidenceIds} sourcesById={sourcesById} onOpenSource={onOpenSource} />
              <span>{row.status}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
