import type { CaseReadinessVerdict, ViewKey } from "../types";

type UnlockLevel = "base" | "documents" | "sources" | "analysis" | "litigation";

const items: Array<{ key: ViewKey; label: string; unlock: UnlockLevel }> = [
  { key: "overview", label: "Saksoversikt", unlock: "base" },
  { key: "documents", label: "Dokumenter", unlock: "base" },
  { key: "caseRoom", label: "Saksrom", unlock: "base" },
  { key: "control", label: "Kontrollgrunnlag", unlock: "documents" },
  { key: "chronology", label: "Kronologi", unlock: "sources" },
  { key: "evidence", label: "Bevismatrise", unlock: "sources" },
  { key: "arguments", label: "Anførsler", unlock: "analysis" },
  { key: "contradictions", label: "Motstrid", unlock: "analysis" },
  { key: "risk", label: "Risiko", unlock: "analysis" },
  { key: "litigation", label: "Rettssimulering", unlock: "litigation" },
  { key: "draft", label: "Utkast", unlock: "analysis" },
  { key: "export", label: "Eksport", unlock: "analysis" }
];

interface SidebarProps {
  activeView: ViewKey;
  onNavigate: (view: ViewKey) => void;
  hasDocuments: boolean;
  hasSources: boolean;
  hasAnalysis: boolean;
  readinessVerdict?: CaseReadinessVerdict;
}

function isUnlocked(
  unlock: UnlockLevel,
  hasDocuments: boolean,
  hasSources: boolean,
  hasAnalysis: boolean,
  readinessVerdict?: CaseReadinessVerdict
) {
  if (unlock === "litigation") {
    return readinessVerdict?.status !== "not_ready";
  }
  if (unlock === "documents") {
    return hasDocuments;
  }
  if (unlock === "sources") {
    return hasSources;
  }
  if (unlock === "analysis") {
    return hasAnalysis;
  }
  return true;
}

function lockedReason(unlock: UnlockLevel) {
  if (unlock === "litigation") {
    return "Åpnes når saken har dokumenter og minst forhåndsvisning av kildegrunnlag.";
  }
  if (unlock === "documents") {
    return "Åpnes etter at minst ett dokument er importert.";
  }
  if (unlock === "sources") {
    return "Åpnes når Evida har sporbare kildeutdrag.";
  }
  if (unlock === "analysis") {
    return "Åpnes etter foreløpig analyse av kildegrunnlaget.";
  }
  return "";
}

export function Sidebar({ activeView, onNavigate, hasDocuments, hasSources, hasAnalysis, readinessVerdict }: SidebarProps) {
  return (
    <nav className="sidebar" aria-label="Hovednavigasjon">
      <div className="brand">
        <img className="brand-logo" src="/logo.png" alt="" />
        <div>
          <div className="brand-name">Evida</div>
          <div className="brand-subtitle">Kildebasert saksrom</div>
        </div>
      </div>
      {readinessVerdict ? (
        <div className={`sidebar-readiness sidebar-readiness--${readinessVerdict.status}`}>
          <strong>{readinessVerdict.label}</strong>
          <span>{readinessVerdict.nextStep}</span>
        </div>
      ) : null}
      <ul>
        {items.map((item) => {
          const unlocked = isUnlocked(item.unlock, hasDocuments, hasSources, hasAnalysis, readinessVerdict);
          return (
            <li key={item.key} title={unlocked ? item.label : lockedReason(item.unlock)}>
              <button
                className={`${item.key === activeView ? "active" : ""} ${!unlocked ? "locked" : ""}`}
                onClick={() => unlocked && onNavigate(item.key)}
                disabled={!unlocked}
              >
                {item.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
