interface EmptyStateActionProps {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}

export function EmptyStateAction({
  title,
  description,
  actionLabel,
  onAction
}: EmptyStateActionProps) {
  return (
    <div className="empty-action">
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <button onClick={onAction}>{actionLabel}</button>
    </div>
  );
}
