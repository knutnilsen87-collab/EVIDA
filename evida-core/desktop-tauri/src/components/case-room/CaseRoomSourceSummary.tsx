interface CaseRoomSourceSummaryProps {
  sourceCount: number;
  notCitableCount: number;
  onOpenControl: () => void;
}

export function CaseRoomSourceSummary({
  sourceCount,
  notCitableCount,
  onOpenControl
}: CaseRoomSourceSummaryProps) {
  return (
    <section className="case-room-source-summary" aria-label="Kildegrunnlag">
      <div>
        <strong>Saksrom er klart</strong>
        <p>
          Dette Saksrommet bygger på {sourceCount} godkjente {sourceCount === 1 ? "kilde" : "kilder"}.
          {notCitableCount > 0
            ? ` ${notCitableCount} ${notCitableCount === 1 ? "dokument er" : "dokumenter er"} ikke brukt fordi de mangler lesbar tekst.`
            : " Alle kontrollerte dokumenter med kildeutdrag kan brukes i svar."}
        </p>
      </div>
      <button type="button" className="button-secondary" onClick={onOpenControl}>
        Vis kildegrunnlag
      </button>
    </section>
  );
}
