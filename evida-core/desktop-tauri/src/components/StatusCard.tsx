import type { ReactNode } from "react";

export type StatusTone = "neutral" | "info" | "ok" | "warn" | "danger" | "source";

interface Props {
  label: string;
  value: string | number;
  detail?: string;
  tone?: StatusTone;
  icon?: ReactNode;
  progress?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function StatusCard({ label, value, detail, tone = "neutral", icon, progress, action }: Props) {
  const safeProgress = progress === undefined ? undefined : Math.max(0, Math.min(100, Math.round(progress)));
  return (
    <section className={`status-card status-card--${tone}`} data-tone={tone}>
      <div className="status-card__top">
        {icon ? <span className="status-card__icon">{icon}</span> : null}
        <div className="status-card__label">{label}</div>
      </div>
      <div className="status-card__value">{value ?? "Ukjent"}</div>
      {detail && <div className="status-card__detail">{detail}</div>}
      {safeProgress !== undefined ? (
        <div className="status-card__progress" aria-label={`${label}: ${safeProgress} prosent`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={safeProgress}>
          <span style={{ width: `${safeProgress}%` }} />
          <strong>{safeProgress} %</strong>
        </div>
      ) : null}
      {action ? (
        <button type="button" className="button-ghost status-card__action" onClick={action.onClick}>
          {action.label}
        </button>
      ) : null}
    </section>
  );
}
