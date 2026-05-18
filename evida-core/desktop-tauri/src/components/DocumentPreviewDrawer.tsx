import { useEffect, useRef, useState } from "react";
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
  onOpenOriginalFolder: (path: string) => void;
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
  onReplaceFile,
  onOpenOriginalFolder
}: DocumentPreviewDrawerProps) {
  const dialogRef = useRef<HTMLElement | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);

  useEffect(() => {
    if (isOpen && document) {
      dialogRef.current?.focus();
    }
  }, [document, isOpen]);

  useEffect(() => {
    setPreviewFailed(false);
  }, [document?.id]);

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
  const canOpenOriginalFolder = Boolean(document.local_path);
  const shouldShowTextPreview = kind === "text" || kind === "docx_text" || kind === "unsupported" || (kind === "pdf" && !previewUrl);
  const shouldShowPreviewFallback = !previewUrl || previewFailed;

  return (
    <div className="drawer-backdrop" role="presentation" onClick={onClose}>
      <aside
        ref={dialogRef}
        className="source-drawer document-preview-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Dokumentpreview"
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
          {kind === "pdf" && previewUrl && !previewFailed ? (
            <iframe
              className="document-preview-frame"
              src={previewUrl}
              title={`Preview av ${document.original_name}`}
              onError={() => setPreviewFailed(true)}
            />
          ) : null}
          {kind === "image" && previewUrl && !previewFailed ? (
            <img
              className="document-preview-image"
              src={previewUrl}
              alt={`Preview av ${document.original_name}`}
              onError={() => setPreviewFailed(true)}
            />
          ) : null}
          {(kind === "pdf" || kind === "image") && shouldShowPreviewFallback ? (
            <div className="document-preview-fallback" role="status">
              <strong>Preview kunne ikke vises inne i Evida.</strong>
              <p>Originalfilen kan fortsatt åpnes fra lokal mappe for visuell kontroll.</p>
              {canOpenOriginalFolder ? (
                <button className="button-secondary" type="button" onClick={() => onOpenOriginalFolder(document.local_path)}>
                  Åpne originalmappe
                </button>
              ) : null}
            </div>
          ) : null}
          {shouldShowTextPreview ? (
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
            {approvalState === "saving" ? "Lagrer ..." : approvalState === "approved" ? "Kontrollert" : approveLabel}
          </button>
          <button className="button-secondary" type="button" disabled={approvalState === "saving"} onClick={() => onExcludeFromCase(document.id)}>
            Hold utenfor kildegrunnlaget
          </button>
          <button className="button-secondary" type="button" disabled={approvalState === "saving"} onClick={() => onReplaceFile(document.id)}>
            Erstatt fil
          </button>
          {canOpenOriginalFolder ? (
            <button className="button-secondary" type="button" onClick={() => onOpenOriginalFolder(document.local_path)}>
              Åpne originalmappe
            </button>
          ) : null}
          <button className="button-ghost" type="button" onClick={onClose}>
            Lukk preview
          </button>
        </div>
      </aside>
    </div>
  );
}
