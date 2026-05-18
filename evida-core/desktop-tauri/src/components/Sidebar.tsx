import type { ViewKey } from "../types";
import type { CaseReadinessVerdict } from "../features/readiness/caseReadiness";
import type { RoomAvailability } from "../features/rooms/roomAvailability";
import { getSidebarStateLabel, roomKeyForView } from "../features/rooms/roomAvailability";
import { WORKROOM_THEME, workroomKeyForView, workroomStyle } from "../lib/workroomTheme";
import { WorkroomIcon } from "./WorkroomIcon";

type UnlockLevel = "base" | "documents" | "analysis" | "simulation" | "draft";

const groups: Array<{ title: string; items: Array<{ key: ViewKey; label: string; unlock: UnlockLevel }> }> = [
  {
    title: "Arbeid",
    items: [
      { key: "overview", label: "Saksoversikt", unlock: "base" },
      { key: "documents", label: "Dokumenter", unlock: "base" },
      { key: "documentControl", label: "Dokumentkontroll", unlock: "documents" },
      { key: "caseRoom", label: "Saksrom", unlock: "base" }
    ]
  },
  {
    title: "Analyse",
    items: [
      { key: "chronology", label: "Kronologi", unlock: "analysis" },
      { key: "evidence", label: "Bevismatrise", unlock: "analysis" },
      { key: "arguments", label: "Anførsler", unlock: "analysis" },
      { key: "contradictions", label: "Motstrid", unlock: "analysis" },
      { key: "risk", label: "Risiko", unlock: "analysis" },
      { key: "litigationSimulation", label: "Rettssimulering", unlock: "simulation" }
    ]
  },
  {
    title: "Produksjon",
    items: [
      { key: "draft", label: "Utkast", unlock: "draft" },
      { key: "export", label: "Eksport", unlock: "draft" }
    ]
  }
];

interface SidebarProps {
  activeView: ViewKey;
  onNavigate: (view: ViewKey) => void;
  hasDocuments: boolean;
  readinessVerdict: CaseReadinessVerdict;
  roomAvailabilityByView?: Partial<Record<ViewKey, RoomAvailability>>;
  onNewCase: () => void;
  onNewCaseInNewWindow: () => void;
  onOpenCaseSwitcher: () => void;
  isCreatingCase?: boolean;
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

function sidebarAvailabilityFor(
  item: { key: ViewKey; label: string; unlock: UnlockLevel },
  hasDocuments: boolean,
  readinessVerdict: CaseReadinessVerdict,
  roomAvailabilityByView?: Partial<Record<ViewKey, RoomAvailability>>
) {
  const roomAvailability = roomKeyForView(item.key) ? roomAvailabilityByView?.[item.key] : undefined;
  if (roomAvailability) {
    return {
      unlocked: roomAvailability.enabled,
      stateLabel: getSidebarStateLabel(roomAvailability),
      reason: roomAvailability.reason || roomAvailability.warning || item.label
    };
  }

  const unlocked = isUnlocked(item.unlock, hasDocuments, readinessVerdict);
  return {
    unlocked,
    stateLabel: unlocked ? "Klar" : item.unlock === "documents" ? "Krever kilder" : "Krever dokumentkontroll",
    reason: unlocked ? item.label : lockedReason(item.unlock)
  };
}

export function Sidebar({
  activeView,
  onNavigate,
  hasDocuments,
  readinessVerdict,
  roomAvailabilityByView,
  onNewCase,
  onNewCaseInNewWindow,
  onOpenCaseSwitcher,
  isCreatingCase = false
}: SidebarProps) {
  const visibleGroups = hasDocuments
    ? groups
    : groups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => item.key === "caseRoom" || item.key === "documents")
        }))
        .filter((group) => group.items.length > 0);

  return (
    <nav className="sidebar" aria-label="Hovednavigasjon">
      <div className="brand">
        <img className="brand-logo" src="/logo.png" alt="" />
        <div>
          <div className="brand-name">Evida</div>
          <div className="brand-subtitle">Kildebasert saksrom</div>
        </div>
      </div>
      <div className="sidebar-actions">
        <button type="button" className="button-primary" onClick={onNewCase} disabled={isCreatingCase}>
          {isCreatingCase ? "Oppretter ..." : "+ Ny sak"}
        </button>
        <button type="button" className="button-secondary" onClick={onOpenCaseSwitcher}>Bytt sak</button>
        <button type="button" className="button-ghost" onClick={onNewCaseInNewWindow}>Ny sak i nytt vindu</button>
      </div>
      {visibleGroups.map((group) => (
        <div className="sidebar-group" key={group.title}>
          <div className="sidebar-group__title">{group.title}</div>
          <ul>
            {group.items.map((item) => {
              const availability = sidebarAvailabilityFor(item, hasDocuments, readinessVerdict, roomAvailabilityByView);
              const { unlocked } = availability;
              const themeKey = workroomKeyForView(item.key);
              const theme = WORKROOM_THEME[themeKey];
              const active = item.key === activeView;
              return (
                <li key={item.key} title={availability.reason}>
                  <button
                    className={`sidebar-item ${active ? "sidebar-item--active active" : ""} ${!unlocked ? "locked" : ""}`}
                    style={workroomStyle(themeKey)}
                    onClick={() => unlocked && onNavigate(item.key)}
                    disabled={!unlocked}
                    aria-current={active ? "page" : undefined}
                  >
                    <span className="sidebar-item__marker" aria-hidden="true" />
                    <span className="sidebar-item__icon">
                      <WorkroomIcon name={theme.icon} size={17} />
                    </span>
                    <span className="sidebar-item__label">{theme.label}</span>
                    <span className={`sidebar-item__state sidebar-item__state--${unlocked ? "open" : "locked"}`}>
                      {availability.stateLabel}
                    </span>
                  </button>
                  {!unlocked ? <small className="sidebar-item__helper">{availability.reason}</small> : null}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
