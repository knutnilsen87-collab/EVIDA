import type { CaseReadinessSeverity } from "../../features/readiness/caseReadiness";

interface ReadinessStatusCardProps {
  label: string;
  title: string;
  body: string;
  missing?: string[];
  primaryActionLabel: string;
  severity: CaseReadinessSeverity;
  onPrimaryAction: () => void;
  onShowDetails?: () => void;
  detailsLabel?: string;
}

export function ReadinessStatusCard({
  label,
  title,
  body,
  missing = [],
  primaryActionLabel,
  severity,
  onPrimaryAction,
  onShowDetails,
  detailsLabel = "Vis detaljer"
}: ReadinessStatusCardProps) {
  return (
    <div className={`readiness-status-card readiness-status-card--${severity}`} aria-live="polite">
      <div>
        <span className="status-chip">{label}</span>
        <h2>{title}</h2>
        <p>{body}</p>
        {missing.length > 0 ? (
          <ul className="readiness-status-card__missing">
            {missing.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="readiness-status-card__actions">
        <button className="button-primary" type="button" onClick={onPrimaryAction}>
          {primaryActionLabel}
        </button>
        {onShowDetails ? (
          <button className="button-secondary" type="button" onClick={onShowDetails}>
            {detailsLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
