interface PrivacyPreAlphaNoticeProps {
  onDismiss?: () => void;
}

export function PrivacyPreAlphaNotice({ onDismiss }: PrivacyPreAlphaNoticeProps) {
  return (
    <section className="privacy-prealpha-notice" aria-label="Evaluation build">
      <div>
        <strong>Evaluation build</strong>
        <p>Bruk testdata. Dokumentene behandles lokalt på denne maskinen. Ikke bruk reelle klientdata uten særskilt avtale.</p>
      </div>
      {onDismiss ? (
        <button type="button" className="button-secondary" onClick={onDismiss}>
          Forstått
        </button>
      ) : null}
    </section>
  );
}
