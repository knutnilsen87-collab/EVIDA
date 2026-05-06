import type { SourceObjectSummary } from "../../types";

interface SourceButtonListProps {
  ids: string[];
  sourcesById: Map<string, SourceObjectSummary>;
  onOpenSource: (sourceId: string) => void;
}

export function sourceTitle(source?: SourceObjectSummary) {
  if (!source) {
    return "Ingen kilde";
  }
  return `${source.document_id} side ${source.page_start}`;
}

export function SourceButtonList({ ids, sourcesById, onOpenSource }: SourceButtonListProps) {
  if (ids.length === 0) {
    return <span className="muted">Ingen</span>;
  }

  return (
    <div className="source-chip-list">
      {ids.map((id) => (
        <button key={id} className="source-chip" onClick={() => onOpenSource(id)}>
          {sourceTitle(sourcesById.get(id))}
        </button>
      ))}
    </div>
  );
}
