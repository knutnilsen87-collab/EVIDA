import type { CaseSummary } from "../types";

type Props = {
  open: boolean;
  cases: CaseSummary[];
  activeCaseId: string | null;
  onClose: () => void;
  onOpenInCurrentWindow: (caseId: string) => void;
  onOpenInNewWindow: (caseId: string) => void;
  onRenameCase: (caseId: string, name: string) => void;
};

function formatDate(value?: string | null) {
  if (!value) {
    return "Ikke åpnet";
  }
  return new Date(value).toLocaleString("no-NO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function CaseSwitcher({
  open,
  cases,
  activeCaseId,
  onClose,
  onOpenInCurrentWindow,
  onOpenInNewWindow,
  onRenameCase
}: Props) {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section className="modal case-switcher" role="dialog" aria-modal="true" aria-label="Bytt sak" onClick={(event) => event.stopPropagation()}>
        <div className="case-switcher__header">
          <div>
            <p className="eyebrow">Tidligere saker</p>
            <h2>Bytt sak</h2>
          </div>
          <button type="button" className="button-secondary" onClick={onClose}>
            Lukk
          </button>
        </div>
        {cases.length === 0 ? (
          <p className="muted">Ingen saker er opprettet ennå.</p>
        ) : (
          <div className="case-switcher__list">
            {cases.map((item) => (
              <article key={item.id} className={`case-switcher__row ${item.id === activeCaseId ? "is-active" : ""}`}>
                <div>
                  <h3>{item.name}</h3>
                  <p>
                    {item.case_number ? `Saksnr. ${item.case_number} · ` : ""}
                    {item.document_count} dokumenter · {item.page_count} sider · {Math.round(item.source_coverage_percent)} % dekning
                  </p>
                  <small>Sist åpnet: {formatDate(item.last_opened_at || item.updated_at)}</small>
                </div>
                <div className="case-switcher__actions">
                  <button type="button" className="button-primary" onClick={() => onOpenInCurrentWindow(item.id)}>
                    Åpne
                  </button>
                  <button type="button" className="button-secondary" onClick={() => onOpenInNewWindow(item.id)}>
                    Åpne i nytt vindu
                  </button>
                  <button
                    type="button"
                    className="button-ghost"
                    onClick={() => {
                      const nextName = window.prompt("Nytt saksnavn", item.name)?.trim();
                      if (nextName) {
                        onRenameCase(item.id, nextName);
                      }
                    }}
                  >
                    Gi nytt navn
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
