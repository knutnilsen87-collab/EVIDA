import type { WorkroomKey } from "../lib/workroomTheme";
import { WORKROOM_THEME, workroomStyle } from "../lib/workroomTheme";
import { WorkroomIcon } from "./WorkroomIcon";

type HeaderStat = {
  label: string;
  value: string | number;
  tone?: "neutral" | "ok" | "warn" | "danger";
};

type WorkroomHeaderProps = {
  workroom: WorkroomKey;
  title?: string;
  subtitle?: string;
  stats?: HeaderStat[];
};

export function WorkroomHeader({ workroom, title, subtitle, stats = [] }: WorkroomHeaderProps) {
  const theme = WORKROOM_THEME[workroom];
  return (
    <section className="workroom-header" style={workroomStyle(workroom)} aria-label={`Arbeidsflate: ${theme.label}`}>
      <div className="workroom-header__main">
        <div className="workroom-header__icon">
          <WorkroomIcon name={theme.icon} size={22} />
        </div>
        <div>
          <p className="eyebrow">{theme.label}</p>
          <h2>{title || theme.label}</h2>
          <p>{subtitle || theme.purpose}</p>
        </div>
      </div>
      {stats.length > 0 ? (
        <div className="workroom-header__stats" aria-label="Nøkkeltall">
          {stats.map((stat) => (
            <span key={`${stat.label}-${stat.value}`} className={`workroom-header__stat workroom-header__stat--${stat.tone || "neutral"}`}>
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}
