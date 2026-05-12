import type { SourceObjectSummary } from "../../types";
import { EvidenceChip } from "../EvidenceChip";

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
        <EvidenceChip
          key={id}
          sourceId={id}
          documentLabel={sourcesById.get(id)?.document_id}
          page={sourcesById.get(id)?.page_start}
          excerpt={sourcesById.get(id)?.text_excerpt}
          confidence="medium"
          status="verified"
          onClick={() => onOpenSource(id)}
        />
      ))}
    </div>
  );
}
