import { EmptyStateAction } from "../EmptyStateAction";
import type { RiskRow } from "./types";

interface RiskViewProps {
  rows: RiskRow[];
  onAssess: () => void;
}

export function RiskView({ rows, onAssess }: RiskViewProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Risiko</h2>
          <p>Risikopunkter, alvorlighet, berørte anførsler, kildegrunnlag og anbefalt tiltak.</p>
        </div>
        <button className="button-primary" onClick={onAssess}>Kjør risikovurdering</button>
      </div>
      {rows.length === 0 ? (
        <EmptyStateAction
          title="Risikoanalyse ikke kjørt."
          description="Risiko vises som egne vurderingspunkter, ikke rå kildeutdrag."
          actionLabel="Kjør risikovurdering"
          onAction={onAssess}
        />
      ) : (
        <div className="work-table risk-table work-table--risk">
          <div>Risiko</div>
          <div>Alvorlighet</div>
          <div>Berørte anførsler</div>
          <div>Kildegrunnlag</div>
          <div>Anbefalt tiltak</div>
          {rows.map((row) => (
            <div className="work-row" key={row.id}>
              <strong>{row.risk}</strong>
              <span className={`risk-badge risk-badge--${row.severity.toLowerCase()}`}>{row.severity || "Ukjent"}</span>
              <span>{row.affectedArguments}</span>
              <span>{row.sourceBasis}</span>
              <span>{row.recommendedAction}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
