import type { SourceObjectSummary } from "../../types";
import { EmptyStateAction } from "../EmptyStateAction";
import { sourceTitle } from "./SourceButtonList";
import type { TimelineItem } from "./types";

interface ChronologyViewProps {
  items: TimelineItem[];
  sourcesById: Map<string, SourceObjectSummary>;
  onBuild: () => void;
  onOpenSource: (sourceId: string) => void;
  buildLabel?: string;
}

export function ChronologyView({ items, sourcesById, onBuild, onOpenSource, buildLabel = "Bygg kronologi fra kilder" }: ChronologyViewProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Kronologi</h2>
          <p>Tidslinjeobjekter med dato, hendelse, kilde, status og usikkerhet.</p>
        </div>
        <button className="button-primary" onClick={onBuild}>{buildLabel}</button>
      </div>
      {items.length === 0 ? (
        <EmptyStateAction
          title="Ingen kronologi bygget ennå."
          description="Kronologi er en egen arbeidsflate og viser ikke r\u00e5 tekstutdrag som hovedinnhold."
          actionLabel={buildLabel}
          onAction={onBuild}
        />
      ) : (
        <div className="work-table chronology-table work-table--timeline">
          <div>Dato</div>
          <div>Hendelse</div>
          <div>Kilde</div>
          <div>Status</div>
          <div>Usikkerhet</div>
          {items.map((item) => (
            <div className="work-row" key={item.id}>
              <span className="timeline-date">{item.date}</span>
              <strong>{item.event}</strong>
              <button className="link-button" onClick={() => onOpenSource(item.sourceId)}>
                {sourceTitle(sourcesById.get(item.sourceId))}
              </button>
              <span>{item.status}</span>
              <span>{item.uncertainty}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
