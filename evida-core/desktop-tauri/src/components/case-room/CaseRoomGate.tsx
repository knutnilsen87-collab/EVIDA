interface CaseRoomGateProps {
  title: string;
  body: string;
  primaryLabel: string;
  onPrimaryAction: () => void;
}

export function CaseRoomGate({ title, body, primaryLabel, onPrimaryAction }: CaseRoomGateProps) {
  return (
    <section className="panel case-room-gate" role="status" aria-live="polite">
      <div className="panel-header">
        <div>
          <div className="eyebrow">Saksrom</div>
          <h2>{title}</h2>
          <p>{body}</p>
        </div>
        <button className="button-primary" type="button" onClick={onPrimaryAction}>
          {primaryLabel}
        </button>
      </div>
    </section>
  );
}
