interface NextActionProps {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  step?: number;
  stepTotal?: number;
  why?: string;
  secondaryLabel?: string;
  onSecondaryAction?: () => void;
  compact?: boolean;
}

export function NextAction({
  title,
  description,
  actionLabel,
  onAction,
  step,
  stepTotal,
  why,
  secondaryLabel,
  onSecondaryAction,
  compact = false
}: NextActionProps) {
  return (
    <section className={`next-action ${compact ? "next-action--compact" : ""}`}>
      <div>
        <div className="eyebrow">
          Neste anbefalte handling
          {step && stepTotal ? <span>Steg {step} av {stepTotal}</span> : null}
        </div>
        <h2>{title}</h2>
        <p>{description}</p>
        {why ? <p className="next-action__why">{why}</p> : null}
      </div>
      <div className="next-action__actions">
        <button className="button-primary" onClick={onAction}>{actionLabel}</button>
        {secondaryLabel && onSecondaryAction ? (
          <button className="button-ghost" onClick={onSecondaryAction}>{secondaryLabel}</button>
        ) : null}
      </div>
    </section>
  );
}
