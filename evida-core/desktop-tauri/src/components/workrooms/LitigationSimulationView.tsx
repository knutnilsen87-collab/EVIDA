import type { CaseReadinessVerdict } from "../../features/readiness/caseReadiness";
import type { SourceObjectSummary } from "../../types";

type SimulationId =
  | "judge_panel"
  | "opposing_counsel"
  | "cross_examination"
  | "direct_examination"
  | "procedure_test"
  | "settlement"
  | "simulated_judgment";

interface SimulationCard {
  id: SimulationId;
  title: string;
  description: string;
  sourceBasis: string;
  riskLevel: "Lav" | "Middels" | "Høy";
  recommendedUse: string;
}

interface LitigationSimulationViewProps {
  readinessVerdict: CaseReadinessVerdict;
  sources: SourceObjectSummary[];
  onOpenSource: (sourceId: string) => void;
}

const SIMULATION_CARDS: SimulationCard[] = [
  {
    id: "judge_panel",
    title: "Dommerpanel",
    description: "Tester hvordan saken kan bli møtt med nøkterne dommerspørsmål.",
    sourceBasis: "Krever kildebasert saksforståelse og sentrale bevispunkter.",
    riskLevel: "Middels",
    recommendedUse: "Bruk etter at hovedspor og usikkerhet er identifisert."
  },
  {
    id: "opposing_counsel",
    title: "Motpartens advokat",
    description: "Presser saken fra motpartens beste mulige vinkel.",
    sourceBasis: "Krever bevismatrise, risiko og mulige motstridspunkter.",
    riskLevel: "Middels",
    recommendedUse: "Bruk for å finne svake ledd før prosesskriv eller møte."
  },
  {
    id: "cross_examination",
    title: "Kryssforhør",
    description: "Tester forklaringer mot dokumenterte hendelser og avvik.",
    sourceBasis: "Krever kilder knyttet til aktører, datoer og forklaringer.",
    riskLevel: "Høy",
    recommendedUse: "Bruk som treningsverktøy, ikke som faktisk avhørsfasit."
  },
  {
    id: "direct_examination",
    title: "Direkte eksaminasjon",
    description: "Forbereder ryddig forklaring med kildebasert rekkefølge.",
    sourceBasis: "Krever kronologi og identifiserte nøkkelkilder.",
    riskLevel: "Middels",
    recommendedUse: "Bruk til struktur og hull-liste før manuell forberedelse."
  },
  {
    id: "procedure_test",
    title: "Prosedyretest",
    description: "Stress-tester argumentlinjen mot kilder, usikkerhet og motargumenter.",
    sourceBasis: "Krever anførsler, bevis og risikopunkter.",
    riskLevel: "Høy",
    recommendedUse: "Bruk sent i forberedelsen, før utkastkontroll."
  },
  {
    id: "settlement",
    title: "Forlikssimulering",
    description: "Tester forhandlingsrom, svake punkter og mulige kompromisstemaer.",
    sourceBasis: "Krever risiko, sentrale krav og dokumenterte beløp eller hendelser.",
    riskLevel: "Middels",
    recommendedUse: "Bruk for å forberede spørsmål, ikke for å fastsette strategi alene."
  },
  {
    id: "simulated_judgment",
    title: "Simulert dom",
    description: "Treningsmodus som viser hvordan en domsstruktur kan angripe saken.",
    sourceBasis: "Krever høy dekning, bevismatrise, anførsler og manuell kontroll.",
    riskLevel: "Høy",
    recommendedUse: "Bruk kun som overtrust-test. Resultatet er ikke domsprognose."
  }
];

function firstSentence(value: string) {
  const sentence = value.split(/[.!?]\s/)[0] || value;
  return sentence.length > 150 ? `${sentence.slice(0, 147)}...` : sentence;
}

function isFullSimulation(readinessVerdict: CaseReadinessVerdict) {
  return readinessVerdict === "ready_for_draft_control";
}

function canRunCard(card: SimulationCard, readinessVerdict: CaseReadinessVerdict) {
  if (readinessVerdict === "not_ready") {
    return false;
  }
  if (card.id === "simulated_judgment") {
    return isFullSimulation(readinessVerdict);
  }
  return readinessVerdict === "ready_for_preliminary_analysis" || readinessVerdict === "ready_for_draft_control";
}

export function LitigationSimulationView({
  readinessVerdict,
  sources,
  onOpenSource
}: LitigationSimulationViewProps) {
  const fullSimulation = isFullSimulation(readinessVerdict);
  const selectedSources = sources.slice(0, 4);

  return (
    <section className="simulation-workspace">
      <div className="panel simulation-hero">
        <div>
          <div className="eyebrow">Rettssimulering</div>
          <h2>Stress-test saken separat fra Saksrom</h2>
          <p>
            Rettssimulering er et trenings- og forberedelsesverktøy. Resultater er ikke domsprognoser,
            juridisk fasit eller erstatning for advokatens vurdering.
          </p>
        </div>
        <span className={fullSimulation ? "status-chip status-chip--ok" : "status-chip status-chip--warn"}>
          {fullSimulation ? "Full simulering tilgjengelig" : "Forberedelsesmodus"}
        </span>
      </div>

      {readinessVerdict === "requires_control" ? (
        <div className="warning-notice">
          Grunnlaget krever kontroll. Simulering vises som forhåndsvisning til dokumentdekningen er klar nok.
        </div>
      ) : null}

      <div className="simulation-grid">
        {SIMULATION_CARDS.map((card) => {
          const locked = !canRunCard(card, readinessVerdict);
          return (
            <article key={card.id} className={`simulation-card ${locked ? "simulation-card--locked" : ""}`}>
              <div>
                <div className="simulation-card__topline">
                  <h3>{card.title}</h3>
                  <span className={card.riskLevel === "Høy" ? "status-chip status-chip--warn" : "status-chip"}>
                    Risiko: {card.riskLevel}
                  </span>
                </div>
                <p>{card.description}</p>
                <dl>
                  <dt>Kildegrunnlag</dt>
                  <dd>{card.sourceBasis}</dd>
                  <dt>Anbefalt bruk</dt>
                  <dd>{card.recommendedUse}</dd>
                </dl>
              </div>
              {card.id === "simulated_judgment" ? (
                <div className="warning-notice">
                  Simulert dom er høyrisiko og kun trening. Den skal ikke presentere sannsynlighet som sikkerhet.
                </div>
              ) : null}
              <details className="simulation-result">
                <summary>{locked ? "Låst av readiness" : "Vis simulert resultat"}</summary>
                <div className="simulation-result__body">
                  <p>
                    <strong>Antakelser:</strong> Resultatet bygger bare på tilgjengelige lokale kildeutdrag og er
                    ufullstendig uten manuell prosessuell vurdering.
                  </p>
                  <p>
                    <strong>Usikkerhet:</strong> {fullSimulation ? "Middels. Kontroller mot kildene." : "Høy. Grunnlaget er ikke klart for full simulering."}
                  </p>
                  <p>
                    <strong>Manuell kontroll:</strong> Bruk dette som treningsnotat. Juridiske vurderinger må godkjennes manuelt.
                  </p>
                  {selectedSources.length > 0 ? (
                    <div className="case-source-list">
                      {selectedSources.map((source) => (
                        <button
                          key={source.id}
                          type="button"
                          className="case-source-pill"
                          onClick={() => onOpenSource(source.id)}
                        >
                          <strong>{source.document_id} · side {source.page_start}</strong>
                          <span>{firstSentence(source.text_excerpt)}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">Ingen kilder tilgjengelig for simulering.</p>
                  )}
                </div>
              </details>
            </article>
          );
        })}
      </div>
    </section>
  );
}
