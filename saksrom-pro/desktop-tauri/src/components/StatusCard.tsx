interface Props {
  label: string;
  value: string | number;
  detail?: string;
  tone?: "neutral" | "ok" | "warn" | "danger";
}

export function StatusCard({ label, value, detail, tone = "neutral" }: Props) {
  return (
    <section className={`status-card status-card--${tone}`}>
      <div className="status-card__label">{label}</div>
      <div className="status-card__value">{value}</div>
      {detail && <div className="status-card__detail">{detail}</div>}
    </section>
  );
}
