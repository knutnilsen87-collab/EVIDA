import { ShieldCheck } from "lucide-react";

type EvidenceChipProps = {
  sourceId: string;
  documentLabel?: string;
  page?: number;
  excerpt?: string;
  confidence?: "low" | "medium" | "high" | "unknown";
  status?: "indexed" | "needs_ocr" | "unsupported" | "verified";
  onClick?: () => void;
};

export function EvidenceChip({
  sourceId,
  documentLabel,
  page,
  excerpt,
  confidence = "unknown",
  status = "indexed",
  onClick
}: EvidenceChipProps) {
  const label = `${documentLabel || sourceId}${page ? ` · side ${page}` : ""}`;
  const confidenceLabel =
    confidence === "high" ? "Høy støtte" :
    confidence === "medium" ? "Middels støtte" :
    confidence === "low" ? "Svak støtte" :
    "Ukjent støtte";
  const statusLabel =
    status === "verified" ? "Verifisert kilde" :
    status === "needs_ocr" ? "Krever OCR" :
    status === "unsupported" ? "Ikke støttet" :
    "Indeksert kilde";

  return (
    <button
      type="button"
      className={`evidence-chip evidence-chip--${status} evidence-chip--${confidence}`}
      onClick={onClick}
      aria-label={`${label}. ${statusLabel}. ${confidenceLabel}`}
    >
      <ShieldCheck size={14} aria-hidden="true" />
      <span>{label}</span>
      <small>{statusLabel}</small>
      {excerpt ? <span className="evidence-chip__excerpt">{excerpt}</span> : null}
    </button>
  );
}
