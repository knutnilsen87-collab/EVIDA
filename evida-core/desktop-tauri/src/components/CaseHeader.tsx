import { Settings } from "lucide-react";
import type { CaseSummary } from "../types";

type Props = {
  selectedCase: CaseSummary | undefined;
  coveragePercent: number;
  hasDocuments: boolean;
  hasSources: boolean;
  pendingOcrPages: number;
  deviations: string[];
  screenSharingMode?: boolean;
  onOpenCaseSwitcher: () => void;
  onNewCase: () => void;
  onOpenSettings: () => void;
};

function readinessLabel(input: Pick<Props, "coveragePercent" | "hasDocuments" | "hasSources" | "pendingOcrPages" | "deviations">) {
  if (!input.hasDocuments) {
    return { badge: "Ikke startet", message: "Start med dokumentene" };
  }
  if (!input.hasSources) {
    return { badge: "Krever kontroll", message: "Dokumenter importert, men mangler sporbare kilder" };
  }
  if (input.coveragePercent < 80) {
    return { badge: "Lav dekning", message: "Ikke klar for trygg analyse" };
  }
  if (input.coveragePercent < 95 || input.pendingOcrPages > 0 || input.deviations.length > 0) {
    return { badge: "Foreløpig", message: "Kan gi foreløpig Saksrom-oppsummering" };
  }
  return { badge: "Klar for utkastkontroll", message: "Dokumentgrunnlaget er klart for kontrollert arbeid" };
}

export function CaseHeader({
  selectedCase,
  coveragePercent,
  hasDocuments,
  hasSources,
  pendingOcrPages,
  deviations,
  screenSharingMode,
  onOpenCaseSwitcher,
  onNewCase,
  onOpenSettings
}: Props) {
  const readiness = readinessLabel({ coveragePercent, hasDocuments, hasSources, pendingOcrPages, deviations });
  const caseName = selectedCase ? selectedCase.name : "Ingen aktiv sak";
  const visibleName = screenSharingMode && selectedCase ? "Aktiv sak" : caseName;

  return (
    <header className="case-header" aria-label="Aktiv sak">
      <div>
        <p className="eyebrow">Aktiv sak</p>
        <h1>{visibleName}</h1>
        <div className="case-header__meta">
          {selectedCase?.case_number && !screenSharingMode ? <span>Saksnr. {selectedCase.case_number}</span> : null}
          <span>{selectedCase?.document_count ?? 0} dokumenter</span>
          <span>{selectedCase?.page_count ?? 0} sider</span>
          <span>{Math.round(coveragePercent)} % kildedekning</span>
        </div>
      </div>
      <div className="case-header__status">
        <span className="case-header__badge">{readiness.badge}</span>
        <span>{readiness.message}</span>
      </div>
      <div className="case-header__actions">
        <button type="button" className="button-secondary" onClick={onOpenCaseSwitcher}>
          Bytt sak
        </button>
        <button type="button" className="button-primary" onClick={onNewCase}>
          + Ny sak
        </button>
        <button type="button" className="icon-button" onClick={onOpenSettings} aria-label="Innstillinger" title="Innstillinger">
          <Settings size={18} />
        </button>
      </div>
    </header>
  );
}
