interface CitationChipProps {
  label: string;
  title: string;
  pageNumber?: number;
  onOpen: () => void;
}

export function CitationChip({ label, title, pageNumber, onOpen }: CitationChipProps) {
  const pageLabel = pageNumber ? ` side ${pageNumber}` : "";
  return (
    <button
      type="button"
      className="saksrom-source-tag"
      title={`${title}${pageLabel}`}
      aria-label={`Åpne kilde ${title}${pageLabel}`}
      onClick={onOpen}
    >
      {label}{pageLabel ? ` ·${pageLabel}` : ""}
    </button>
  );
}
