import { useMemo, useState } from "react";
import type { CaseReadinessVerdict, CaseSummary, DocumentSummary, SourceObjectSummary } from "../types";

type SimulationMode =
  | "judge_panel"
  | "opposing_counsel"
  | "cross_examination"
  | "direct_examination"
  | "closing_argument_test"
  | "settlement_simulation"
  | "judgment_simulation";

type SimulationRisk = "Lav" | "Middels" | "Høy";

interface SimulationCard {
  mode: SimulationMode;
  title: string;
  does: string;
  sourceBasis: string;
  risk: SimulationRisk;
  recommendedUse: string;
  requiresDraftReady?: boolean;
}

interface LitigationSimulationViewProps {
  selectedCase?: CaseSummary;
  documents: DocumentSummary[];
  sources: SourceObjectSummary[];
  readinessVerdict: CaseReadinessVerdict;
  coverage: number;
  pendingOcrPages: number;
  deviations: string[];
  initialContext?: string;
  onOpenSource: (sourceId: string) => void;
  onOpenControl: () => void;
}

const simulationCards: SimulationCard[] = [
  {
    mode: "judge_panel",
    title: "Dommerpanel",
    does: "Stiller kritiske spørsmål om rettslig grunnlag, bevis, frister, motstrid og hva retten trolig vil presse på.",
    sourceBasis: "Foreløpige kildeutdrag er nok for første spørsmålsrunde.",
    risk: "Middels",
    recommendedUse: "Bruk etter kronologi/bevisliste for å finne uklare premisser.",
  },
  {
    mode: "opposing_counsel",
    title: "Motpartens advokat",
    does: "Angriper saken fra motpartens beste perspektiv: alternative forklaringer, svake bevis og prosessinnsigelser.",
    sourceBasis: "Bør ha kildeutdrag for sentrale påstander eller tydelige hull.",
    risk: "Middels",
    recommendedUse: "Bruk før prosedyre, forlik eller utkast.",
  },
  {
    mode: "cross_examination",
    title: "Kryssforhør",
    does: "Lager temaer, spørsmål, formål, kildegrunnlag, risiko og oppfølgingsspørsmål.",
    sourceBasis: "Krever dokumenterte hendelser, datoer eller forklaringsavvik.",
    risk: "Middels",
    recommendedUse: "Bruk når du vet hvilket vitne, part eller tema som skal testes.",
  },
  {
    mode: "direct_examination",
    title: "Direkte eksaminasjon",
    does: "Lager ikke-ledende spørsmål for klient eller vitne, dokumentnært og kronologisk.",
    sourceBasis: "Bør ha kronologi og dokumentkoblinger.",
    risk: "Lav",
    recommendedUse: "Bruk for å bygge ryddig forklaring uten å overstyre vitnet.",
  },
  {
    mode: "closing_argument_test",
    title: "Prosedyretest",
    does: "Tester sterkeste og svakeste punkt, dommerspørsmål, motpartens replikk og anbefalt justering.",
    sourceBasis: "Krever foreløpig anførsel, bevisliste eller risikopunkt.",
    risk: "Middels",
    recommendedUse: "Bruk før prosedyre, sluttinnlegg eller intern kvalitetssjekk.",
  },
  {
    mode: "settlement_simulation",
    title: "Forlikssimulering",
    does: "Strukturerer forliksrom, presspunkter, prosesskostnadsrisiko og uavklarte forhold uten å garantere utfall.",
    sourceBasis: "Bør ha krav/verdi, bevisstyrke og risikopunkter.",
    risk: "Middels",
    recommendedUse: "Bruk før tilbud eller forhandlingsmandat.",
  },
  {
    mode: "judgment_simulation",
    title: "Simulert dom",
    does: "Skisserer hvordan et domsresonnement kan struktureres basert på materialet.",
    sourceBasis: "Krever klar for utkastkontroll, høy dekning og manuell rettskilde-/fristkontroll.",
    risk: "Høy",
    recommendedUse: "Bruk sist, som overtrust-test og kontroll av hva som fortsatt mangler.",
    requiresDraftReady: true,
  },
];

function firstSentence(value: string) {
  const sentence = value.split(/[.!?]\s/)[0] || value;
  return sentence.length > 150 ? `${sentence.slice(0, 147)}...` : sentence;
}

function sourceLine(source: SourceObjectSummary, index: number) {
  return `K${index + 1}: ${source.document_id}, side ${source.page_start || "?"} - ${firstSentence(source.text_excerpt)}`;
}

function selectedSourcesFor(card: SimulationCard, sources: SourceObjectSummary[], context?: string) {
  const terms = `${card.title} ${card.does} ${context || ""}`
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((term) => term.length > 3);

  const ranked = sources
    .map((source) => ({
      source,
      score: terms.reduce((score, term) => score + (source.text_excerpt.toLowerCase().includes(term) ? 1 : 0), 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  return ranked.length ? ranked.map((item) => item.source) : sources.slice(0, 6);
}

function resultFor(card: SimulationCard, selected: SourceObjectSummary[], props: LitigationSimulationViewProps) {
  const sourceRows = selected.map(sourceLine);
  const sourcesText = sourceRows.length ? sourceRows.map((line) => `- ${line}`).join("\n") : "- Ingen konkrete kildeutdrag valgt.";
  const deviationsText = props.deviations.length ? props.deviations.map((item) => `- ${item}`).join("\n") : "- Ingen registrerte importavvik i denne visningen.";
  const contextText = props.initialContext ? `Kontekst fra Saksrom:\n${props.initialContext}\n\n` : "";

  const commonFooter = [
    "",
    "KILDER",
    sourcesText,
    "",
    "ANTAKELSER",
    "- Simuleringen bruker lokale kildeutdrag der de finnes.",
    "- Utdrag uten direkte treff behandles som kontrollgrunnlag, ikke som bevis for konklusjon.",
    "- Brukeropplysninger eller kontekst fra Saksrom må kontrolleres mot dokument eller forklaring.",
    "",
    "USIKKERHET",
    `- Readiness: ${props.readinessVerdict.label}.`,
    `- Dekning: ${props.coverage}%.`,
    `- OCR/tekstkontroll: ${props.pendingOcrPages} sider venter.`,
    deviationsText,
    "",
    "MANUELL KONTROLL",
    "- Dette er et trenings- og forberedelsesverktøy.",
    "- Resultatet er ikke domsprognose, juridisk fasit eller erstatning for advokatens vurdering.",
    "- Rettskilder, frister, dokumenthenvisninger og prosessuelle vurderinger må verifiseres manuelt før bruk.",
  ].join("\n");

  if (card.mode === "judge_panel") {
    return `${contextText}DOMMERPANEL\n\n1. Hvilket konkret rettslig grunnlag bygger dette på?\n2. Hvilke faktiske forhold er dokumentert, og hvilke bygger på forklaring?\n3. Hvor i dokumentene finner retten støtte for hovedpunktet?\n4. Hva er det sterkeste motargumentet?\n5. Hvilke frister eller prosessuelle vilkår er kontrollert?\n${commonFooter}`;
  }
  if (card.mode === "opposing_counsel") {
    return `${contextText}MOTPARTENS ADVOKAT\n\nMotparten vil trolig angripe:\n1. Dokumentasjonen for sentrale faktum.\n2. Årsakssammenheng, tap eller kravets størrelse.\n3. Alternative forklaringer som passer bedre med kildene.\n4. Frister, reklamasjon og prosessuelle vilkår.\n\nAnbefalt justering:\n- Lag kildebro fra hvert hovedfaktum til dokument/side.\n- Ha svar på motpartens beste versjon før prosedyre.\n${commonFooter}`;
  }
  if (card.mode === "cross_examination") {
    return `${contextText}KRYSSFORHØR\n\nTema: Tidslinje, kunnskap og dokumentert reaksjon.\n\nSpørsmål:\n1. Når ble De kjent med dette forholdet?\n2. Hvilket dokument viser det?\n3. Protesterte De skriftlig på dette tidspunktet?\n4. Finnes det dokumentasjon på en annen forklaring?\n\nFormål:\nEtablere kunnskap, passivitet, avvik eller svak alternativ forklaring.\n\nRisiko:\nSpørsmålene kan åpne for muntlige forklaringer eller nye dokumenter. Følg opp med konkret dokumentasjon.\n${commonFooter}`;
  }
  if (card.mode === "direct_examination") {
    return `${contextText}DIREKTE EKSAMINASJON\n\nMål:\nFå frem faktum kronologisk, nøkternt og dokumentnært.\n\nSpørsmål:\n1. Hva skjedde først?\n2. Hva gjorde du etterpå?\n3. Hvilke dokumenter viser dette?\n4. Hva var konsekvensen?\n5. Er det noe i dokumentene som kan forstås annerledes?\n${commonFooter}`;
  }
  if (card.mode === "closing_argument_test") {
    return `${contextText}PROSEDYRETEST\n\nSterkeste punkt:\n${selected[0] ? firstSentence(selected[0].text_excerpt) : "Ikke nok kildegrunnlag til å peke ut."}\n\nSvakeste punkt:\nRettskilder, frister og motpartens beste alternative forklaring må kontrolleres.\n\nMulig dommerspørsmål:\nHvor er dokumentgrunnlaget for den avgjørende faktapåstanden?\n\nAnbefalt justering:\n- Prioriter dokumenterte fakta først.\n- Flytt usikre punkter til kontrollpunkter.\n${commonFooter}`;
  }
  if (card.mode === "settlement_simulation") {
    return `${contextText}FORLIKSSIMULERING\n\nBeste realistiske utfall:\nKan ikke tallfestes uten krav/verdi og prosesskostnadsgrunnlag.\n\nMotpartens presspunkt:\nUklare bevis, frister, rettslig usikkerhet eller kostnadsrisiko.\n\nVår pressfaktor:\n${selected[0] ? sourceLine(selected[0], 0) : "Mangler valgt kildepunkt."}\n\nAnbefalt bruk:\nStrukturer forhandlingsmandat, ikke konkluder med garantert økonomisk utfall.\n${commonFooter}`;
  }
  return `${contextText}SIMULERT DOM\n\nEKSTRA OVERTRUST-VARSEL:\nDette er trening. Det er ikke en prediksjon, sannsynlighetsberegning eller juridisk garanti.\n\nMulig domsstruktur:\n1. Faktum retten kan legge til grunn hvis kildene holder.\n2. Motpartens alternative forklaring.\n3. Rettslig grunnlag som må verifiseres.\n4. Punkter som kan endre utfallet.\n\nDet skal ikke presenteres prosenter eller sikker konklusjon.\n${commonFooter}`;
}

export function LitigationSimulationView(props: LitigationSimulationViewProps) {
  const [activeMode, setActiveMode] = useState<SimulationMode | null>(null);
  const activeCard = simulationCards.find((card) => card.mode === activeMode);
  const selectedSources = useMemo(
    () => (activeCard ? selectedSourcesFor(activeCard, props.sources, props.initialContext) : []),
    [activeCard, props.sources, props.initialContext],
  );
  const result = activeCard ? resultFor(activeCard, selectedSources, props) : "";
  const previewOnly = props.readinessVerdict.status === "needs_control";
  const locked = props.readinessVerdict.status === "not_ready";

  return (
    <section className="litigation-workspace">
      <div className="panel litigation-hero">
        <p className="eyebrow">Rettssimulering</p>
        <h2>{props.selectedCase?.name || "Valgt sak"}</h2>
        <p>
          Rettssimulering er et trenings- og forberedelsesverktøy. Resultater er ikke domsprognoser,
          juridisk fasit eller erstatning for advokatens vurdering.
        </p>
        <div className={`readiness-verdict readiness-verdict--${props.readinessVerdict.status}`}>
          <strong>{props.readinessVerdict.label}</strong>
          <span>{props.readinessVerdict.description}</span>
          <small>{props.readinessVerdict.detail}</small>
          {locked || previewOnly ? (
            <button type="button" className="button-secondary" onClick={props.onOpenControl}>
              Åpne kontrollgrunnlag
            </button>
          ) : null}
        </div>
        {props.initialContext ? (
          <div className="litigation-context">
            <strong>Kontekst fra Saksrom</strong>
            <span>{props.initialContext}</span>
          </div>
        ) : null}
      </div>

      <div className="simulation-card-grid">
        {simulationCards.map((card) => {
          const disabled = locked || previewOnly || (card.requiresDraftReady && props.readinessVerdict.status !== "draft_ready");
          return (
            <article key={card.mode} className={`simulation-card ${card.risk === "Høy" ? "simulation-card--high-risk" : ""}`}>
              <div>
                <strong>{card.title}</strong>
                <span>Risiko: {card.risk}</span>
              </div>
              <p>{card.does}</p>
              <dl>
                <dt>Kildegrunnlag</dt>
                <dd>{card.sourceBasis}</dd>
                <dt>Anbefalt bruk</dt>
                <dd>{card.recommendedUse}</dd>
              </dl>
              {card.requiresDraftReady ? (
                <div className="simulation-warning">Høy risiko: trening-only. Ikke presenter som domsprognose.</div>
              ) : null}
              <button type="button" className="button-primary" disabled={disabled} onClick={() => setActiveMode(card.mode)}>
                {previewOnly ? "Forhåndsvisning låst" : card.requiresDraftReady && props.readinessVerdict.status !== "draft_ready" ? "Krever utkastkontroll" : "Kjør simulering"}
              </button>
            </article>
          );
        })}
      </div>

      {activeCard ? (
        <section className="panel simulation-result">
          <div className="panel-header">
            <div>
              <h2>{activeCard.title}</h2>
              <p>Simulert resultat med kilder, antakelser, usikkerhet og manuell kontroll.</p>
            </div>
          </div>
          <pre>{result}</pre>
          {selectedSources.length ? (
            <div className="case-source-list">
              {selectedSources.map((source, index) => (
                <button key={source.id} type="button" className="case-source-pill" onClick={() => props.onOpenSource(source.id)}>
                  <strong>{source.document_id} · side {source.page_start || "?"}</strong>
                  <span>{sourceLine(source, index)}</span>
                </button>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}

