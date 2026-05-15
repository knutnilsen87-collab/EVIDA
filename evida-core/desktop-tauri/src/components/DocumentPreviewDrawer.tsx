import { convertFileSrc } from "@tauri-apps/api/core";
import type { DocumentSummary, SourceObjectSummary } from "../types";

interface DocumentPreviewDrawerProps {
  document: DocumentSummary | null;
  sources: SourceObjectSummary[];
  isOpen: boolean;
  approvalState?: "idle" | "saving" | "approved";
  attentionRemaining?: number;
  onClose: () => void;
  onApproveAsSource: (documentId: string) => void;
  onExcludeFromCase: (documentId: string) => void;
  onReplaceFile: (documentId: string) => void;
}

type PreviewKind = "pdf" | "image" | "text" | "docx_text" | "unsupported";

function extension(name: string) {
  const value = name.split(".").pop()?.toLowerCase() || "";
  return value;
}

function previewKind(document: DocumentSummary): PreviewKind {
  const ext = extension(document.original_name);
  const mime = document.mime_type?.toLowerCase() || "";
  if (mime.includes("pdf") || ext === "pdf") {
    return "pdf";
  }
  if (mime.startsWith("image/") || ["png", "jpg", "jpeg", "tif", "tiff", "bmp"].includes(ext)) {
    return "image";
  }
  if (["txt", "md", "markdown", "csv", "log"].includes(ext) || mime.startsWith("text/")) {
    return "text";
  }
  if (ext === "docx" || mime.includes("wordprocessingml")) {
    return "docx_text";
  }
  return "unsupported";
}

function sourceText(sources: SourceObjectSummary[]) {
  return sources
    .slice(0, 8)
    .map((source) => `Side ${source.page_start}${source.page_end !== source.page_start ? `-${source.page_end}` : ""}\n${source.text_excerpt}`)
    .join("\n\n");
}

function fileUrl(document: DocumentSummary) {
  try {
    return document.local_path ? convertFileSrc(document.local_path) : "";
  } catch {
    return "";
  }
}

export function DocumentPreviewDrawer({
  document,
  sources,
  isOpen,
  approvalState = "idle",
  attentionRemaining,
  onClose,
  onApproveAsSource,
  onExcludeFromCase,
  onReplaceFile
}: DocumentPreviewDrawerProps) {
  if (!isOpen || !document) {
    return null;
  }

  const kind = previewKind(document);
  const previewUrl = fileUrl(document);
  const extractedText = sourceText(sources);
  const sourceCoverage = Math.round(document.source_coverage_percent || 0);
  const hasExtractedText = extractedText.trim().length > 0;
  const hasUsableSources = document.source_count > 0;
  const approveLabel = hasUsableSources ? "Bruk som kildegrunnlag" : "Marker som kontrollert";

  return (
    <div className="drawer-backdrop" role="presentation" onClick={onClose}>
      <aside
        className="source-drawer document-preview-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Dokumentpreview"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="drawer-header">
          <div>
            <h2>{document.original_name}</h2>
            <p>{document.mime_type || extension(document.original_name).toUpperCase() || "Ukjent filtype"}</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Lukk preview">
            ×
          </button>
        </div>

        <div className="drawer-meta document-preview-meta">
          <span>OCR/text-status</span>
          <strong>{document.ocr_status}</strong>
          <span>Kildedekning</span>
          <strong>{sourceCoverage} %</strong>
          <span>Sider</span>
          <strong>{document.page_count || "Ukjent"}</strong>
          <span>Kildeutdrag</span>
          <strong>{document.source_count}</strong>
        </div>

        <div className="document-preview-content">
          {kind === "pdf" && previewUrl ? (
            <iframe className="document-preview-frame" src={previewUrl} title={`Preview av ${document.original_name}`} />
          ) : null}
          {kind === "image" && previewUrl ? (
            <img className="document-preview-image" src={previewUrl} alt={`Preview av ${document.original_name}`} />
          ) : null}
          {(kind === "text" || kind === "docx_text" || kind === "unsupported" || (kind === "pdf" && !previewUrl)) ? (
            <div className={kind === "text" ? "document-preview-text document-preview-text--mono" : "document-preview-text"}>
              {hasExtractedText ? (
                <pre>{extractedText}</pre>
              ) : (
                <p>
                  {kind === "unsupported"
                    ? "Preview er ikke tilgjengelig for denne filtypen ennå."
                    : "Evida har ikke et lesbart tekstutdrag å vise ennå."}
                </p>
              )}
            </div>
          ) : null}
          {kind === "image" ? (
            <div className="document-preview-text">
              {hasExtractedText ? <pre>{extractedText}</pre> : <p>Siden mangler maskinlesbar tekst.</p>}
            </div>
          ) : null}
        </div>

        <div className="document-preview-actions">
          {approvalState === "approved" ? (
            <div className="document-approval-feedback" role="status">
              <strong>✓ Kontrollert</strong>
              {typeof attentionRemaining === "number" && attentionRemaining > 0 ? (
                <span>Neste dokument åpnes automatisk.</span>
              ) : (
                <span>Alle dokumenter er kontrollert.</span>
              )}
            </div>
          ) : null}
          <button
            className="button-primary"
            type="button"
            disabled={approvalState === "saving" || approvalState === "approved"}
            onClick={() => onApproveAsSource(document.id)}
          >
            {approvalState === "saving" ? "Godkjenner ..." : approvalState === "approved" ? "Godkjent" : approveLabel}
          </button>
          <button className="button-secondary" type="button" disabled={approvalState === "saving"} onClick={() => onExcludeFromCase(document.id)}>
            Ikke bruk som kilde
          </button>
          <button className="button-secondary" type="button" disabled={approvalState === "saving"} onClick={() => onReplaceFile(document.id)}>
            Erstatt fil
          </button>
          <button className="button-ghost" type="button" onClick={onClose}>
            Lukk preview
          </button>
        </div>
      </aside>
    </div>
  );
}
