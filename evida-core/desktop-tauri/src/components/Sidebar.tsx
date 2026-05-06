import type { ViewKey } from "../types";

type UnlockLevel = "base" | "documents" | "sources" | "analysis";

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
  { key: "draft", label: "Utkast", unlock: "analysis" },
  { key: "export", label: "Eksport", unlock: "analysis" }
];

interface SidebarProps {
  activeView: ViewKey;
  onNavigate: (view: ViewKey) => void;
  hasDocuments: boolean;
  hasSources: boolean;
  hasAnalysis: boolean;
}

function isUnlocked(unlock: UnlockLevel, hasDocuments: boolean, hasSources: boolean, hasAnalysis: boolean) {
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

export function Sidebar({ activeView, onNavigate, hasDocuments, hasSources, hasAnalysis }: SidebarProps) {
  return (
    <nav className="sidebar" aria-label="Hovednavigasjon">
      <div className="brand">
        <img className="brand-logo" src="/logo.png" alt="" />
        <div>
          <div className="brand-name">Evida</div>
          <div className="brand-subtitle">Kildebasert saksrom</div>
        </div>
      </div>
      <ul>
        {items.map((item) => {
          const unlocked = isUnlocked(item.unlock, hasDocuments, hasSources, hasAnalysis);
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
