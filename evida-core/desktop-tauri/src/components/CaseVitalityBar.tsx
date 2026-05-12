import { CoverageBar, NextBestActionCard, ProgressPill, RiskBadge } from "./ProgressPrimitives";

export type CaseVitality = {
  sourceCoveragePct?: number;
  ocrCoveragePct?: number;
  indexedDocumentCount?: number;
  totalDocumentCount?: number;
  unresolvedConflictCount?: number;
  riskLevel?: "low" | "medium" | "high" | "unknown" | string;
  nextBestAction?: string;
};

export function CaseVitalityBar({
  vitality,
  compact = false
}: {
  vitality: CaseVitality;
  compact?: boolean;
}) {
  const indexed =
    vitality.indexedDocumentCount === undefined || vitality.totalDocumentCount === undefined
      ? "Ukjent"
      : `${vitality.indexedDocumentCount}/${vitality.totalDocumentCount}`;
  return (
    <section className={`case-vitality-bar ${compact ? "case-vitality-bar--compact" : ""}`} aria-label="Sakskraft">
      <div>
        <p className="eyebrow">Sakskraft</p>
        <strong>Fremdrift og kontroll</strong>
      </div>
      <CoverageBar label="Kilder" value={vitality.sourceCoveragePct} unknown={vitality.sourceCoveragePct === undefined} />
      <CoverageBar label="OCR" value={vitality.ocrCoveragePct} unknown={vitality.ocrCoveragePct === undefined} />
      <ProgressPill label="Dokumenter" value={indexed} />
      <ProgressPill label="Motstrid" value={vitality.unresolvedConflictCount ?? "Ukjent"} />
      <RiskBadge value={vitality.riskLevel} />
      <NextBestActionCard action={vitality.nextBestAction} />
    </section>
  );
}
