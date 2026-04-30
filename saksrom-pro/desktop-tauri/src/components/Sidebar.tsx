const items = [
  "Saksoversikt",
  "Dokumenter",
  "Kronologi",
  "Bevis",
  "Anførsler",
  "Motstrid",
  "Risiko",
  "Utkast",
  "Kontroll",
  "Eksport"
];

export function Sidebar() {
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
        {items.map((item, index) => (
          <li key={item}>
            <button className={index === 0 ? "active" : ""}>{item}</button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
