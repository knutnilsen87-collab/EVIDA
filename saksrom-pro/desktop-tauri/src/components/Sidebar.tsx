import type { ViewKey } from "../types";

const items: Array<{ key: ViewKey; label: string }> = [
  { key: "overview", label: "Saksoversikt" },
  { key: "documents", label: "Dokumenter" },
  { key: "caseRoom", label: "Saksrom" },
  { key: "chronology", label: "Kronologi" },
  { key: "evidence", label: "Bevismatrise" },
  { key: "arguments", label: "Anførsler" },
  { key: "contradictions", label: "Motstrid" },
  { key: "risk", label: "Risiko" },
  { key: "draft", label: "Utkast" },
  { key: "control", label: "Kontrollrapport" },
  { key: "export", label: "Eksport" }
];

interface SidebarProps {
  activeView: ViewKey;
  onNavigate: (view: ViewKey) => void;
}

export function Sidebar({ activeView, onNavigate }: SidebarProps) {
  return (
    <nav className="sidebar" aria-label="Hovednavigasjon">
      <div className="brand">
        <div className="brand-mark">§</div>
        <div>
          <div className="brand-name">Saksrom Pro</div>
          <div className="brand-subtitle">Proofroom engine</div>
        </div>
      </div>
      <ul>
        {items.map((item) => (
          <li key={item.key}>
            <button
              className={item.key === activeView ? "active" : ""}
              onClick={() => onNavigate(item.key)}
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
