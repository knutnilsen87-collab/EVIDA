import { useEffect, useRef } from "react";
import type { SourceObjectSummary } from "../types";

interface SourcePreviewDrawerProps {
  source?: SourceObjectSummary;
  title?: string;
  onClose: () => void;
}

export function SourcePreviewDrawer({ source, title, onClose }: SourcePreviewDrawerProps) {
  const dialogRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (source) {
      dialogRef.current?.focus();
    }
  }, [source]);

  if (!source) {
    return null;
  }

  return (
    <div className="drawer-backdrop" role="presentation" onClick={onClose}>
      <aside
        ref={dialogRef}
        className="source-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Kildevisning"
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            onClose();
          }
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="drawer-header">
          <div>
            <h2>{title || "Kildeutdrag"}</h2>
            <p>
              {source.document_id} · side {source.page_start}
              {source.page_end !== source.page_start ? `-${source.page_end}` : ""}
            </p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Lukk kildevisning">
            ×
          </button>
        </div>
        <div className="drawer-meta">
          <span>Kilde-ID</span>
          <code>{source.id}</code>
          <span>SHA-256</span>
          <code>{source.sha256}</code>
        </div>
        <div className="drawer-text">{source.text_excerpt}</div>
      </aside>
    </div>
  );
}
