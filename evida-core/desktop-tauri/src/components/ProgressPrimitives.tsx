export function CoverageBar({
  label,
  value,
  unknown = false
}: {
  label: string;
  value?: number;
  unknown?: boolean;
}) {
  const safeValue = unknown || value === undefined ? undefined : Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="coverage-bar" aria-label={`${label}: ${safeValue === undefined ? "Ukjent" : `${safeValue} prosent`}`}>
      <div className="coverage-bar__label">
        <span>{label}</span>
        <strong>{safeValue === undefined ? "Ukjent" : `${safeValue} %`}</strong>
      </div>
      <div className="coverage-bar__track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={safeValue}>
        <span style={{ width: `${safeValue ?? 0}%` }} />
      </div>
    </div>
  );
}

export function ProgressPill({ label, value }: { label: string; value?: string | number }) {
  return (
    <span className="progress-pill">
      <span>{label}</span>
      <strong>{value ?? "Ukjent"}</strong>
    </span>
  );
}

export function RiskBadge({ value }: { value?: "low" | "medium" | "high" | "unknown" | string }) {
  const normalized = value || "unknown";
  const label =
    normalized === "low" ? "Lav" :
    normalized === "medium" ? "Middels" :
    normalized === "high" ? "Høy" :
    "Ukjent";
  return <span className={`risk-badge risk-badge--${normalized}`}>Risiko {label}</span>;
}

export function ReadinessMeter({ label, value }: { label: string; value?: number }) {
  return <CoverageBar label={label} value={value} unknown={value === undefined} />;
}

export function NextBestActionCard({ action }: { action?: string }) {
  return (
    <div className="next-best-action-card">
      <span>Neste beste handling</span>
      <strong>{action || "Ukjent"}</strong>
    </div>
  );
}
