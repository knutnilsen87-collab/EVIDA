interface NextActionProps {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  compact?: boolean;
}

export function NextAction({
  title,
  description,
  actionLabel,
  onAction,
  compact = false
}: NextActionProps) {
  return (
    <section className={`next-action ${compact ? "next-action--compact" : ""}`}>
      <div>
        <div className="eyebrow">Neste anbefalte handling</div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <button onClick={onAction}>{actionLabel}</button>
    </section>
  );
}
