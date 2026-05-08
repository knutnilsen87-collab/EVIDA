import type { ViewKey } from "../types";
import type { CaseReadinessVerdict } from "../features/readiness/caseReadiness";

type UnlockLevel = "base" | "documents" | "analysis" | "simulation" | "draft";

const items: Array<{ key: ViewKey; label: string; unlock: UnlockLevel }> = [
  { key: "overview", label: "Saksoversikt", unlock: "base" },
  { key: "documents", label: "Dokumenter", unlock: "base" },
  { key: "caseRoom", label: "Saksrom", unlock: "documents" },
  { key: "control", label: "Kontrollgrunnlag", unlock: "documents" },
  { key: "chronology", label: "Kronologi", unlock: "analysis" },
  { key: "evidence", label: "Bevismatrise", unlock: "analysis" },
  { key: "arguments", label: "Anførsler", unlock: "analysis" },
  { key: "contradictions", label: "Motstrid", unlock: "analysis" },
  { key: "risk", label: "Risiko", unlock: "analysis" },
  { key: "litigationSimulation", label: "Rettssimulering", unlock: "simulation" },
  { key: "draft", label: "Utkast", unlock: "draft" },
  { key: "export", label: "Eksport", unlock: "draft" }
];

interface SidebarProps {
  activeView: ViewKey;
  onNavigate: (view: ViewKey) => void;
  hasDocuments: boolean;
  readinessVerdict: CaseReadinessVerdict;
}

function isUnlocked(unlock: UnlockLevel, hasDocuments: boolean, readinessVerdict: CaseReadinessVerdict) {
  if (unlock === "documents") {
    return hasDocuments;
  }
  if (unlock === "analysis") {
    return readinessVerdict === "ready_for_preliminary_analysis" || readinessVerdict === "ready_for_draft_control";
  }
  if (unlock === "simulation") {
    return (
      readinessVerdict === "requires_control" ||
      readinessVerdict === "ready_for_preliminary_analysis" ||
      readinessVerdict === "ready_for_draft_control"
    );
  }
  if (unlock === "draft") {
    return readinessVerdict === "ready_for_draft_control";
  }
  return true;
}

function lockedReason(unlock: UnlockLevel) {
  if (unlock === "documents") {
    return "Åpnes etter at minst ett dokument er importert.";
  }
  if (unlock === "analysis") {
    return "Åpnes når dokumentgrunnlaget er klart for foreløpig analyse.";
  }
  if (unlock === "simulation") {
    return "Åpnes som egen treningsflate når saken har kildegrunnlag.";
  }
  if (unlock === "draft") {
    return "Åpnes når dokumentgrunnlaget er klart for utkastkontroll.";
  }
  return "";
}

export function Sidebar({ activeView, onNavigate, hasDocuments, readinessVerdict }: SidebarProps) {
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
          const unlocked = isUnlocked(item.unlock, hasDocuments, readinessVerdict);
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
