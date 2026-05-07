import { useEffect, useMemo, useState } from "react";
import type { CaseAiMessageDto, CaseReadinessVerdict, CaseSummary, DocumentSummary, SourceObjectSummary } from "../types";
import { askCaseAi, listCaseAiMessages, recordCaseAiExchange } from "../lib/api";

interface CaseRoomViewProps {
  selectedCase?: CaseSummary;
  documents: DocumentSummary[];
  sources: SourceObjectSummary[];
  sourcesById: Map<string, SourceObjectSummary>;
  pendingOcrPages: number;
  coverage: number;
  deviations: string[];
  readinessVerdict: CaseReadinessVerdict;
  nextActionTitle: string;
  onOpenSource: (sourceId: string) => void;
  onOpenControl: () => void;
  onOpenLitigation: (context?: string) => void;
}

type LegalWorkMode =
  | "free_chat"
  | "case_understanding"
  | "chronology"
  | "evidence"
  | "crosslink"
  | "claims"
  | "contradictions"
  | "counterarguments"
  | "legal_sources"
  | "risk"
  | "draft"
  | "settlement"
  | "quality"
  | "final_control"
  | "redaction"
  | "deadlines"
  | "document_ranking"
  | "strategy"
  | "bates"
  | "litigation_preparation"
  | "trial_hearing"
  | "judge_panel"
  | "opposing_counsel"
  | "cross_examination"
  | "direct_examination"
  | "closing_argument_test"
  | "judgment_simulation"
  | "settlement_simulation"
  | "roleplay"
  | "final_litigation_quality_check";

type LitigationSimulationMode =
  | "trial_hearing"
  | "judge_panel"
  | "opposing_counsel"
  | "cross_examination"
  | "direct_examination"
  | "closing_argument_test"
  | "judgment_simulation"
  | "settlement_simulation"
  | "roleplay"
  | "final_litigation_quality_check";

type LitigationRole =
  | "judge"
  | "opposing_counsel"
  | "own_counsel"
  | "client"
  | "witness"
  | "expert"
  | "mediator"
  | "appeal_panel"
  | "critical_reviewer";

type SimulationIntensity = "mild" | "realistic" | "aggressive" | "judge_critical";

type RequiredReadiness = "has_sources" | "preliminary_ready" | "draft_ready";
type ReadinessLevel = "no_sources" | "has_sources" | "preliminary_ready" | "draft_ready";
type AnswerLength = "short" | "balanced" | "detailed";
type CitationPlacement = "assessment_first" | "sources_first";
type PreferredStructure = "bullets" | "narrative" | "table" | "mixed";

interface SuggestedAction {
  id: string;
  index: number;
  label: string;
  intent: LegalWorkMode;
  queryTemplate: string;
  requiredReadiness: RequiredReadiness;
  createdFromTurnId: string;
  route?: "litigation";
}

interface RetrievalSnapshot {
  strategy: string;
  candidateSourceIds: string[];
  selectedSourceIds: string[];
  coverage: number;
  pendingOcrPages: number;
  deviations: string[];
  readiness: ReadinessLevel;
}

interface CaseAnswer {
  turnId: string;
  answer: string;
  sourceIds: string[];
  validatedSources: Array<{
    sourceId: string;
    documentId: string;
    pageNumber?: number;
    validationStatus: string;
  }>;
  answerStrength: {
    level: "Lav" | "Middels" | "Høy";
    reason: string;
  };
  uncertainty: string;
  missing: string;
  nextStep: string;
  collaborationMode: LegalWorkMode;
  selectedAction?: SuggestedAction;
  suggestedActions: SuggestedAction[];
  retrievalSnapshot: RetrievalSnapshot;
  blockedReason?: string;
}

interface WorkstylePreferences {
  answerLength: AnswerLength;
  preferredStructure: PreferredStructure;
  citationPlacement: CitationPlacement;
  showSuggestions: boolean;
  showWorkStates: boolean;
  preferredMode: LegalWorkMode;
  legalLanguageLevel: "plain" | "professional" | "technical";
  showDetailedWorkStates: boolean;
}

interface CaseConversationMemory {
  previousAssistantAnswer: string;
  suggestedActions: SuggestedAction[];
  selectedAction?: SuggestedAction;
  retrievalSnapshot: RetrievalSnapshot;
  activeCollaborationMode: LegalWorkMode;
  sourcesUsed: string[];
  updatedAt: string;
}

interface ModeDefinition {
  label: string;
  description: string;
  retrievalStrategy: string;
  answerStructure: string;
  sourceRequirements: string;
  uncertaintyHandling: string;
  requiredReadiness: RequiredReadiness;
  formalOutput: boolean;
  nextSuggestedActions: Array<Omit<SuggestedAction, "id" | "index" | "createdFromTurnId">>;
}

interface CommandDefinition {
  command: string;
  aliases: string[];
  mode: LegalWorkMode;
  label: string;
  description: string;
  requiresReadiness: RequiredReadiness;
}

const WORKSTYLE_KEY = "evida-saksrom-workstyle-v2";

const defaultWorkstyle: WorkstylePreferences = {
  answerLength: "balanced",
  preferredStructure: "mixed",
  citationPlacement: "assessment_first",
  showSuggestions: true,
  showWorkStates: true,
  preferredMode: "free_chat",
  legalLanguageLevel: "plain",
  showDetailedWorkStates: false,
};

const defaultWorkStates = [
  "Forstår spørsmålet",
  "Henter relevante kilder",
  "Ser etter mønstre",
  "Sammenligner datoer og aktører",
  "Kontrollerer usikkerhet",
  "Skriver svar",
];

function workStatesForMode(_mode: LegalWorkMode) {
  return defaultWorkStates;
}

const commandDefinitions: CommandDefinition[] = [
  {
    command: "'kronologi",
    aliases: ["lag kronologi", "tidslinje", "hva skjedde når", "bygg faktum over tid"],
    mode: "chronology",
    label: "Kronologi",
    description: "Bygger tidslinje fra dokumenterte hendelser.",
    requiresReadiness: "has_sources",
  },
  {
    command: "'krysskobling",
    aliases: ["krysskobling", "sammenheng", "overlapper", "koblinger"],
    mode: "crosslink",
    label: "Krysskobling",
    description: "Finner overlapp mellom dokumenter, datoer, aktører, krav og forklaringer.",
    requiresReadiness: "has_sources",
  },
  {
    command: "'bevis",
    aliases: ["bevisliste", "hvilke bevis", "koble bevis", "bevisanalyse"],
    mode: "evidence",
    label: "Bevisanalyse",
    description: "Kobler bevis til faktum, anførsler, styrke og svakheter.",
    requiresReadiness: "has_sources",
  },
  {
    command: "'anforsler",
    aliases: ["'anførsler", "anførsler", "lag anførselstavle", "rettslige spørsmål", "claims"],
    mode: "claims",
    label: "Anførsler",
    description: "Strukturerer faktiske og rettslige anførsler.",
    requiresReadiness: "preliminary_ready",
  },
  {
    command: "'motargumenter",
    aliases: ["motargumenter", "svake punkter", "hva vil motparten si", "innsigelser"],
    mode: "counterarguments",
    label: "Motargumenter",
    description: "Finner svake punkter, forventede motargumenter og bevisgap.",
    requiresReadiness: "preliminary_ready",
  },
  {
    command: "'presedens",
    aliases: ["rettskilder", "rettspraksis", "lovkilder", "legal sources"],
    mode: "legal_sources",
    label: "Rettskildekart",
    description: "Strukturerer rettskildesøk og lignende saker for manuell verifisering.",
    requiresReadiness: "has_sources",
  },
  {
    command: "'risiko",
    aliases: ["risikovurdering", "prosessrisiko", "hva er svakt", "risk"],
    mode: "risk",
    label: "Risiko",
    description: "Vurderer bevis-, rettslig, prosessuell og fristrelatert risiko.",
    requiresReadiness: "preliminary_ready",
  },
  {
    command: "'frister",
    aliases: ["frist", "foreldelse", "søksmålsfrist", "deadlines"],
    mode: "deadlines",
    label: "Frister",
    description: "Identifiserer mulige frister og datoer som krever manuell kontroll.",
    requiresReadiness: "has_sources",
  },
  {
    command: "'strategi",
    aliases: ["strategi", "case strategy", "prosessstrategi", "hva bør vi gjøre"],
    mode: "strategy",
    label: "Strategi",
    description: "Lager strukturert saksstrategi med dokumenterte spor og åpne valg.",
    requiresReadiness: "preliminary_ready",
  },
  {
    command: "'forlik",
    aliases: ["forlik", "settlement", "forliksanalyse", "forlikstilbud"],
    mode: "settlement",
    label: "Forlik",
    description: "Strukturerer forliksvurdering basert på risiko og bevis.",
    requiresReadiness: "preliminary_ready",
  },
  {
    command: "'utkast",
    aliases: ["lag utkast", "prosesskriv", "brev", "stevning", "draft"],
    mode: "draft",
    label: "Utkast",
    description: "Lager kontrollert utkast med kildekrav.",
    requiresReadiness: "draft_ready",
  },
  {
    command: "'kvalitet",
    aliases: ["sjekk kvalitet", "kontroller utkast", "innsendingstest", "quality"],
    mode: "quality",
    label: "Kvalitet",
    description: "Sjekker kilder, påstander, frister, motargumenter og svakheter.",
    requiresReadiness: "draft_ready",
  },
  {
    command: "'endelig",
    aliases: ["streng kontroll", "endelig kontroll", "før innsending", "final control"],
    mode: "final_control",
    label: "Endelig kontroll",
    description: "Streng kontrollmodus før juridisk bruk, deling eller innsending.",
    requiresReadiness: "draft_ready",
  },
  {
    command: "'masker",
    aliases: ["masker", "rediger sensitivt", "redaction", "sladd"],
    mode: "redaction",
    label: "Maskering",
    description: "Finner sensitive opplysninger og mulige maskeringsmål.",
    requiresReadiness: "has_sources",
  },
  {
    command: "'bates",
    aliases: ["bates", "nummerering", "dokumentnummer", "referansestruktur"],
    mode: "bates",
    label: "Bates/referanser",
    description: "Foreslår dokumentnummerering og referansestruktur.",
    requiresReadiness: "has_sources",
  },
];

const litigationSimulationModes: LitigationSimulationMode[] = [
  "trial_hearing",
  "judge_panel",
  "opposing_counsel",
  "cross_examination",
  "direct_examination",
  "closing_argument_test",
  "judgment_simulation",
  "settlement_simulation",
  "roleplay",
  "final_litigation_quality_check",
];

const litigationWorkModes: LegalWorkMode[] = ["litigation_preparation", ...litigationSimulationModes];

function isLitigationMode(mode: LegalWorkMode) {
  return litigationWorkModes.includes(mode);
}

function isLitigationSimulationMode(mode: LegalWorkMode): mode is LitigationSimulationMode {
  return litigationSimulationModes.includes(mode as LitigationSimulationMode);
}

const simulationIntensityLabels: Record<SimulationIntensity, string> = {
  mild: "mild",
  realistic: "realistisk",
  aggressive: "aggressiv",
  judge_critical: "dommerkritisk",
};

const litigationRoleLabels: Record<LitigationRole, string> = {
  judge: "Dommer",
  opposing_counsel: "Motpartens advokat",
  own_counsel: "Egen advokat",
  client: "Klient",
  witness: "Vitne",
  expert: "Sakkyndig",
  mediator: "Forliksmekler",
  appeal_panel: "Lagdommerpanel",
  critical_reviewer: "Kritisk kvalitetskontrollør",
};

function action(
  label: string,
  intent: LegalWorkMode,
  queryTemplate: string,
  requiredReadiness: RequiredReadiness,
  route?: SuggestedAction["route"],
): Omit<SuggestedAction, "id" | "index" | "createdFromTurnId"> {
  return { label, intent, queryTemplate, requiredReadiness, route };
}

const modeDefinitions: Record<LegalWorkMode, ModeDefinition> = {
  free_chat: {
    label: "Fri chat",
    description: "Svar på naturlige spørsmål med kilder, usikkerhet og neste steg.",
    retrievalStrategy: "Velg lokale kildeutdrag som matcher spørsmålet, og bruk siste turn som kontekst.",
    answerStructure: "Kort svar, hva det bygger på, usikkerhet/mangler, neste spor og kilder.",
    sourceRequirements: "Minst ett sporbar kildeutdrag for faktapåstander.",
    uncertaintyHandling: "Marker manglende dekning, OCR-ventende sider og svake treff tydelig.",
    requiredReadiness: "has_sources",
    formalOutput: false,
    nextSuggestedActions: [
      action("Finn hovedspor i saken", "case_understanding", "Finn hovedspor i saken basert på kildene.", "has_sources"),
      action("Lag kronologi", "chronology", "Lag en foreløpig kronologi basert på kildene.", "has_sources"),
      action("Finn bevis", "evidence", "Lag bevisliste og koble bevis til faktum.", "has_sources"),
      action("Vurder risiko", "risk", "Vurder bevis-, rettslig og prosessuell risiko.", "preliminary_ready"),
    ],
  },
  case_understanding: {
    label: "Saksforståelse",
    description: "Gir en saksnivåforståelse etter import.",
    retrievalStrategy: "Bred henting av sentrale kilder, gjentatte aktører, datoer og temaer.",
    answerStructure: "Hva saken ser ut til å handle om, hovedspor, mulige mønstre, usikkerhet og anbefalte neste steg.",
    sourceRequirements: "Hvert hovedspor må ha minst én kilde eller merkes som undersøkelsesspor.",
    uncertaintyHandling: "Skill mellom dokumenterte spor og spor som bare bør undersøkes.",
    requiredReadiness: "has_sources",
    formalOutput: false,
    nextSuggestedActions: [
      action("Hvem hadde faktisk kontroll over selskapene?", "crosslink", "Undersøk hvem som faktisk hadde kontroll over selskapene.", "has_sources"),
      action("Hvilke transaksjoner går igjen i flere dokumenter?", "crosslink", "Finn transaksjoner som går igjen i flere dokumenter.", "has_sources"),
      action("Stemmer tidslinjen med forklaringene?", "chronology", "Sammenlign tidslinjen med forklaringene i kildene.", "has_sources"),
      action("Finnes det motstrid mellom forklaring og dokumentasjon?", "contradictions", "Finn motstrid mellom forklaring og dokumentasjon.", "preliminary_ready"),
    ],
  },
  chronology: {
    label: "Kronologi",
    description: "Bygger tidslinje fra dokumenter.",
    retrievalStrategy: "Prioriter kilder med datoer, hendelser, varsel, betalinger og aktørhandlinger.",
    answerStructure: "Tabell med dato, hendelse, dokument/kilde, betydning og usikkerhet.",
    sourceRequirements: "Dato- og hendelsespåstander må knyttes til side/kilde.",
    uncertaintyHandling: "Merk udaterte hendelser og kilder som kan være ufullstendige.",
    requiredReadiness: "has_sources",
    formalOutput: true,
    nextSuggestedActions: [
      action("Vis bare sikre hendelser", "chronology", "Vis bare sikre hendelser i kronologien.", "has_sources"),
      action("Vis usikre eller udaterte hendelser", "chronology", "Vis usikre eller udaterte hendelser i kronologien.", "has_sources"),
      action("Koble kronologi til bevis", "evidence", "Koble kronologien til bevis og kildeutdrag.", "has_sources"),
      action("Finn hull i tidslinjen", "deadlines", "Finn hull, uklare datoer og frister i tidslinjen.", "has_sources"),
    ],
  },
  evidence: {
    label: "Bevisanalyse",
    description: "Kobler bevis til fakta, krav, styrke og svakheter.",
    retrievalStrategy: "Prioriter kildeutdrag som uttrykker faktum, handling, dokumentasjon, varsel, betaling eller avtalevilkår.",
    answerStructure: "Tabell med bevis, hva det støtter, kilde, styrke, svakhet og bruk.",
    sourceRequirements: "Hvert bevispunkt må peke til en kilde.",
    uncertaintyHandling: "Marker svakheter, uklart mottak, manglende fulltekst og behov for originalkontroll.",
    requiredReadiness: "has_sources",
    formalOutput: true,
    nextSuggestedActions: [
      action("Koble bevis til mulige anførsler", "claims", "Koble bevisene til mulige faktiske og rettslige anførsler.", "preliminary_ready"),
      action("Finn bevis som svekker saken", "counterarguments", "Finn bevis og hull som kan svekke saken.", "preliminary_ready"),
      action("Ranger viktigste dokumenter", "document_ranking", "Ranger dokumentene etter bevismessig betydning.", "has_sources"),
      action("Test i Rettssimulering", "risk", "Test dette bevisbildet i Rettssimulering.", "preliminary_ready", "litigation"),
    ],
  },
  crosslink: {
    label: "Krysskobling",
    description: "Finner overlapper mellom dokumenter, datoer, aktører, krav, bevis og forklaringer.",
    retrievalStrategy: "Se etter gjentatte navn, datoer, beløp, dokumenttyper, transaksjonsord og forklaringsmønstre.",
    answerStructure: "Tabell med kobling, hvor den opptrer, mulig betydning, styrke, kilder og neste kontroll.",
    sourceRequirements: "Koblinger må vise hvilke kilder som peker i samme retning.",
    uncertaintyHandling: "Formuler funn som undersøkelsesspor, ikke endelige konklusjoner.",
    requiredReadiness: "has_sources",
    formalOutput: true,
    nextSuggestedActions: [
      action("Hvilke aktører går igjen?", "crosslink", "Finn aktører som går igjen i flere kildeutdrag.", "has_sources"),
      action("Hvilke beløp eller transaksjoner går igjen?", "crosslink", "Finn beløp eller transaksjoner som går igjen.", "has_sources"),
      action("Finn mulig motstrid i koblingene", "contradictions", "Finn mulig motstrid i koblingene.", "preliminary_ready"),
      action("Hva mangler for å bekrefte mønsteret?", "quality", "Finn hva som mangler for å bekrefte mønsteret.", "draft_ready"),
    ],
  },
  claims: {
    label: "Anførsler",
    description: "Hjelper med å formulere og teste faktiske og rettslige anførsler.",
    retrievalStrategy: "Velg kildeklare fakta og bevis som kan støtte eller svekke mulige anførsler.",
    answerStructure: "Anførsel, rettslig grunnlag, faktisk grunnlag, bevis, svakhet, motargument og foreløpig vurdering.",
    sourceRequirements: "Faktisk grunnlag må ha kilde. Rettslig grunnlag må verifiseres manuelt.",
    uncertaintyHandling: "Merk juridiske konklusjoner som foreløpige og advokatstyrte.",
    requiredReadiness: "preliminary_ready",
    formalOutput: true,
    nextSuggestedActions: [
      action("Finn bevis som støtter anførslene", "evidence", "Finn bevis som støtter de mulige anførslene.", "has_sources"),
      action("Finn motpartens sannsynlige innsigelser", "counterarguments", "Finn motpartens sannsynlige innsigelser.", "preliminary_ready"),
      action("Lag risikovurdering av anførslene", "risk", "Vurder risiko knyttet til anførslene.", "preliminary_ready"),
      action("Hvilke rettskilder må undersøkes?", "legal_sources", "Lag rettskildekart for anførslene.", "has_sources"),
    ],
  },
  contradictions: {
    label: "Motstrid",
    description: "Finner mulig motstrid mellom forklaring og dokumentasjon.",
    retrievalStrategy: "Sammenlign kilder med overlappende aktører, datoer, beløp, hendelser og forklaringer.",
    answerStructure: "Mulig motstrid, kilde A, kilde B, betydning og kontrollbehov.",
    sourceRequirements: "Minst to kilder trengs for en reell motstridsvurdering.",
    uncertaintyHandling: "Ikke konkluder med motstrid hvis grunnlaget bare er uklart eller ufullstendig.",
    requiredReadiness: "preliminary_ready",
    formalOutput: true,
    nextSuggestedActions: [
      action("Vis kildene bak viktigste motstrid", "contradictions", "Vis kildene bak den viktigste mulige motstriden.", "preliminary_ready"),
      action("Lag kronologi rundt motstriden", "chronology", "Lag kronologi rundt den mulige motstriden.", "has_sources"),
      action("Finn forklaringer som bør kontrolleres", "counterarguments", "Finn forklaringer som bør kontrolleres mot dokumentasjon.", "preliminary_ready"),
      action("Finn mønsteret bak avvikene", "crosslink", "Finn mønstre bak avvikene i kildene.", "has_sources"),
    ],
  },
  counterarguments: {
    label: "Motargumenter",
    description: "Finner svake punkter, forventede motargumenter og bevisgap.",
    retrievalStrategy: "Se etter hull, forbehold, svake bevis, uklare datoer og kilder som kan tolkes mot saken.",
    answerStructure: "Tabell med punkt, mulig motargument, hva det svekker, kildegrunnlag og tiltak.",
    sourceRequirements: "Motargumenter må knyttes til kilder eller tydelige mangler i kildene.",
    uncertaintyHandling: "Skill mellom faktisk motbevis og prosessuell risiko.",
    requiredReadiness: "preliminary_ready",
    formalOutput: true,
    nextSuggestedActions: [
      action("Vurder prosessrisiko", "risk", "Vurder prosessrisiko basert på motargumentene.", "preliminary_ready"),
      action("Finn bevis som kan tette hullene", "evidence", "Finn bevis som kan tette de identifiserte hullene.", "has_sources"),
      action("Oppdater anførsler med svakheter", "claims", "Oppdater mulige anførsler med svakheter og motargumenter.", "preliminary_ready"),
      action("Test i Rettssimulering", "risk", "Test motargumentene i Rettssimulering.", "preliminary_ready", "litigation"),
    ],
  },
  legal_sources: {
    label: "Rettskildekart",
    description: "Strukturerer rettskildesøk og lignende saker.",
    retrievalStrategy: "Finn lovhenvisninger, kontraktsord, rettslige temaer og faktiske nøkkelspørsmål som kan styre research.",
    answerStructure: "Rettskildetema, mulig kilde, likhet, forskjell, prosessverdi og verifikasjonsbehov.",
    sourceRequirements: "Evida kan strukturere research, men autoritative rettskilder må verifiseres utenfor lokal dokumentmotor.",
    uncertaintyHandling: "Vis obligatorisk varsel om manuell verifisering av rettskilder.",
    requiredReadiness: "has_sources",
    formalOutput: true,
    nextSuggestedActions: [
      action("Finn lovhenvisninger nevnt i dokumentene", "legal_sources", "Finn lovhenvisninger som er nevnt i dokumentene.", "has_sources"),
      action("Koble rettsspørsmål til faktum", "claims", "Koble rettsspørsmål til dokumentert faktum.", "preliminary_ready"),
      action("Vurder rettslig risiko", "risk", "Vurder rettslig risiko som må undersøkes videre.", "preliminary_ready"),
      action("Lag research-spørsmål for advokat", "quality", "Lag research-spørsmål som må verifiseres i autoritativ database.", "draft_ready"),
    ],
  },
  risk: {
    label: "Risiko",
    description: "Vurderer bevisrisiko, rettslig risiko, prosessrisiko, kostnad, troverdighet, frister og forlik.",
    retrievalStrategy: "Kombiner bevisstyrke, mangler, mulige motargumenter, fristindikasjoner og rettslige temaer.",
    answerStructure: "Risikorapport med samlet vurdering, begrunnelse og tiltak.",
    sourceRequirements: "Risikovurdering må vise hvilket kildegrunnlag eller hvilken mangel den bygger på.",
    uncertaintyHandling: "Marker rettslige vurderinger som foreløpige og krev manuell kontroll.",
    requiredReadiness: "preliminary_ready",
    formalOutput: true,
    nextSuggestedActions: [
      action("Finn høyeste bevisrisiko", "risk", "Finn høyeste bevisrisiko i saken.", "preliminary_ready"),
      action("Finn fristrisiko", "deadlines", "Finn mulige frister og foreldelsesrisiko.", "has_sources"),
      action("Finn motargumenter", "counterarguments", "Finn forventede motargumenter og svake punkter.", "preliminary_ready"),
      action("Test i Rettssimulering", "risk", "Test risikopunktene i Rettssimulering.", "preliminary_ready", "litigation"),
    ],
  },
  draft: {
    label: "Utkast",
    description: "Lager kontrollerte utkast basert på kildegrunnlag.",
    retrievalStrategy: "Velg kildeklare fakta, åpne kontrollpunkter og mulig disposisjon.",
    answerStructure: "Utkast med faktisk bakgrunn, rettslig grunnlag, anvendelse, bevis, påstand og kildekontroll.",
    sourceRequirements: "Ingen faktapåstand i utkast uten kilde.",
    uncertaintyHandling: "Usikre formuleringer legges i kontrollpunkter, ikke som ferdige konklusjoner.",
    requiredReadiness: "draft_ready",
    formalOutput: true,
    nextSuggestedActions: [
      action("Vis bare kildeklare fakta", "draft", "Vis bare kildeklare fakta fra utkastgrunnlaget.", "draft_ready"),
      action("Kjør kvalitetssjekk", "quality", "Kvalitetssjekk utkastgrunnlaget.", "draft_ready"),
      action("Finn motargumenter før utkast", "counterarguments", "Finn motargumenter før utkastet brukes.", "preliminary_ready"),
      action("Endelig kontroll", "final_control", "Kjør streng endelig kontroll før bruk.", "draft_ready"),
    ],
  },
  settlement: {
    label: "Forlik",
    description: "Strukturerer forliksvurdering.",
    retrievalStrategy: "Bruk risiko, bevisstyrke, uklare punkter og mulige motargumenter som forliksgrunnlag.",
    answerStructure: "Forliksspor, styrke, svakhet, mulig tilbud, dokumentasjonsbehov og risiko.",
    sourceRequirements: "Forliksvurdering må vise hvilke fakta og usikkerheter den bygger på.",
    uncertaintyHandling: "Ikke gi økonomisk/juridisk anbefaling som fasit; vis beslutningsgrunnlag.",
    requiredReadiness: "preliminary_ready",
    formalOutput: true,
    nextSuggestedActions: [
      action("Finn sterkeste forliksargument", "settlement", "Finn sterkeste forliksargument basert på kildene.", "preliminary_ready"),
      action("Finn svakeste punkt før forhandling", "counterarguments", "Finn svakeste punkt før forhandling.", "preliminary_ready"),
      action("Lag risikomatrise", "risk", "Lag risikomatrise for forliksvurdering.", "preliminary_ready"),
      action("Lag kontrollert forliksgrunnlag", "draft", "Lag kontrollert forliksgrunnlag med kilder.", "draft_ready"),
    ],
  },
  quality: {
    label: "Kvalitet",
    description: "Kontrollerer utkast eller analyse før bruk.",
    retrievalStrategy: "Sjekk kildedekning, dokumenthenvisninger, for sterke formuleringer, motargumenter, rettskilder og frister.",
    answerStructure: "Kvalitetskontroll med faktapåstander uten kilde, referanser, formuleringer, motargumenter og neste steg.",
    sourceRequirements: "Kvalitetssjekk må vise kildegrunnlag og hull.",
    uncertaintyHandling: "Blokker eller marker alt som mangler kilde eller rettskildeverifikasjon.",
    requiredReadiness: "draft_ready",
    formalOutput: true,
    nextSuggestedActions: [
      action("Vis faktapåstander uten kilde", "quality", "Finn faktapåstander uten kilde.", "draft_ready"),
      action("Kontroller dokumenthenvisninger", "quality", "Kontroller dokumenthenvisninger og sider.", "draft_ready"),
      action("Finn manglende motargumenter", "counterarguments", "Finn manglende motargumenter.", "preliminary_ready"),
      action("Endelig kontroll", "final_control", "Kjør streng endelig kontroll.", "draft_ready"),
    ],
  },
  final_control: {
    label: "Endelig kontroll",
    description: "Streng kontroll før juridisk bruk, deling eller innsending.",
    retrievalStrategy: "Kontroller dokumentdekning, kilder, uavklarte faktum, rettskilder, frister, risiko og neste steg.",
    answerStructure: "PROSESSERT, GJENSTÅR, RISIKOVARSEL og NESTE STEG.",
    sourceRequirements: "Alt faktisk grunnlag må være kildeklart.",
    uncertaintyHandling: "Marker alle gjenstående punkter som stoppere før bruk.",
    requiredReadiness: "draft_ready",
    formalOutput: true,
    nextSuggestedActions: [
      action("Vis stoppere før bruk", "final_control", "Vis stoppere før juridisk bruk.", "draft_ready"),
      action("Kontroller frister", "deadlines", "Kontroller frister og datoer.", "has_sources"),
      action("Kontroller rettskilder", "legal_sources", "Kontroller rettskilder som må verifiseres.", "has_sources"),
      action("Masker sensitive opplysninger", "redaction", "Finn sensitive opplysninger som bør maskeres.", "has_sources"),
    ],
  },
  redaction: {
    label: "Maskering",
    description: "Identifiserer sensitiv informasjon og maskeringsmål.",
    retrievalStrategy: "Se etter personopplysninger, helse, økonomi, klientnavn, tredjeparter og taushetsbelagt informasjon.",
    answerStructure: "Tabell med type sensitiv informasjon, forekomst, dokument, side, anbefalt handling og risiko.",
    sourceRequirements: "Maskeringsforslag må knyttes til kilde. Ingen destruktiv redigering uten eksplisitt bekreftelse.",
    uncertaintyHandling: "Marker mulige treff som kontrollpunkter, ikke ferdig maskering.",
    requiredReadiness: "has_sources",
    formalOutput: true,
    nextSuggestedActions: [
      action("Vis mulige personopplysninger", "redaction", "Finn mulige personopplysninger i kildene.", "has_sources"),
      action("Finn tredjeparter", "redaction", "Finn tredjeparter som kan kreve maskering.", "has_sources"),
      action("Lag maskeringsliste", "redaction", "Lag maskeringsliste med dokument og side.", "has_sources"),
      action("Kjør endelig kontroll", "final_control", "Kjør endelig kontroll før deling.", "draft_ready"),
    ],
  },
  deadlines: {
    label: "Frister",
    description: "Identifiserer prosessfrister, foreldelsesrisiko og datoer som må verifiseres.",
    retrievalStrategy: "Hent datoer, varsel, vedtak, oppsigelse, reklamasjon, betalingskrav og prosesshandlinger.",
    answerStructure: "Tabell med fristtype, mulig dato, grunnlag, usikkerhet, må kontrolleres mot og tiltak.",
    sourceRequirements: "Frister må ha kilde eller merkes som manuelt kontrollbehov.",
    uncertaintyHandling: "Alle frister krever manuell juridisk verifisering.",
    requiredReadiness: "has_sources",
    formalOutput: true,
    nextSuggestedActions: [
      action("Vis alle datoer som kan være frister", "deadlines", "Vis alle datoer som kan være frister.", "has_sources"),
      action("Koble frister til kronologi", "chronology", "Koble mulige frister til kronologien.", "has_sources"),
      action("Finn fristrisiko", "risk", "Vurder fristrisiko.", "preliminary_ready"),
      action("Lag kontrollspørsmål om frister", "quality", "Lag kontrollspørsmål om frister.", "draft_ready"),
    ],
  },
  document_ranking: {
    label: "Dokumentrangering",
    description: "Rangerer dokumenter etter betydning.",
    retrievalStrategy: "Prioriter dokumenter med flest relevante kildeutdrag og sterkest treff mot spørsmålet.",
    answerStructure: "Rangert liste med dokument, grunn, kildeutdrag og kontrollbehov.",
    sourceRequirements: "Rangering må bygge på lokale kildeutdrag, ikke filnavn alene.",
    uncertaintyHandling: "Marker dokumenter som kan være viktige, men mangler tekst/OCR.",
    requiredReadiness: "has_sources",
    formalOutput: true,
    nextSuggestedActions: [
      action("Hvorfor er toppdokumentet viktig?", "document_ranking", "Forklar hvorfor toppdokumentet er viktig med kilder.", "has_sources"),
      action("Bygg kronologi fra toppdokumentene", "chronology", "Bygg kronologi fra de viktigste dokumentene.", "has_sources"),
      action("Finn bevis i toppdokumentene", "evidence", "Finn bevis i de viktigste dokumentene.", "has_sources"),
      action("Hva mangler i dokumentpakken?", "quality", "Finn hva som mangler i dokumentpakken.", "draft_ready"),
    ],
  },
  strategy: {
    label: "Strategi",
    description: "Gir strukturert strategioversikt.",
    retrievalStrategy: "Kombiner hovedspor, bevis, motargumenter, risiko og mangler.",
    answerStructure: "Saksstrategi med hovedspor, styrker, svakheter, tiltak og beslutningspunkter.",
    sourceRequirements: "Strategiske punkter må knyttes til dokumenterte fakta eller tydelige mangler.",
    uncertaintyHandling: "Skill mellom dokumentert grunnlag, juridisk vurdering og taktiske valg.",
    requiredReadiness: "preliminary_ready",
    formalOutput: true,
    nextSuggestedActions: [
      action("Finn sterkeste spor", "case_understanding", "Finn sterkeste hovedspor.", "has_sources"),
      action("Finn største risiko", "risk", "Finn største risiko.", "preliminary_ready"),
      action("Finn motargumenter", "counterarguments", "Finn forventede motargumenter.", "preliminary_ready"),
      action("Vurder forlik", "settlement", "Vurder forliksstrategi.", "preliminary_ready"),
    ],
  },
  bates: {
    label: "Bates/referanser",
    description: "Foreslår dokumentnummerering og referansestruktur.",
    retrievalStrategy: "Bruk dokumentliste, kildeutdrag og sideintervaller til referansestruktur.",
    answerStructure: "Forslag til dokumentnummer, sideintervall, kortnavn og bruk i saken.",
    sourceRequirements: "Referansestruktur må bygge på registrerte dokumenter og kilder.",
    uncertaintyHandling: "Merk dokumenter uten side- eller kildegrunnlag som kontrollbehov.",
    requiredReadiness: "has_sources",
    formalOutput: true,
    nextSuggestedActions: [
      action("Ranger dokumentene etter betydning", "document_ranking", "Ranger dokumentene etter betydning.", "has_sources"),
      action("Bygg kronologi med referanser", "chronology", "Bygg kronologi med dokumentreferanser.", "has_sources"),
      action("Lag bevisliste med referanser", "evidence", "Lag bevisliste med dokumentreferanser.", "has_sources"),
      action("Kjør kvalitetssjekk av referanser", "quality", "Kjør kvalitetssjekk av dokumentreferanser.", "draft_ready"),
    ],
  },
  litigation_preparation: {
    label: "Prosessforberedelse",
    description: "Rammer inn rettssakssimulering som trening, kildekontroll og risikotest.",
    retrievalStrategy: "Kombiner kronologi, bevis, anførsler, motargumenter, frister og åpne kontrollpunkter.",
    answerStructure: "RETTSAKSSIMULERING, antakelser, anbefalt rekkefølge, egnet simuleringsmodus, kildestatus, risikopunkter og neste runde.",
    sourceRequirements: "Skal skille dokumenterte kilder, brukeropplysninger, hypotetiske deler og manglende dokumentasjon.",
    uncertaintyHandling: "Simulering er forberedelse/trening, ikke prediksjon, garanti eller erstatning for advokatkontroll.",
    requiredReadiness: "has_sources",
    formalOutput: true,
    nextSuggestedActions: [
      action("Simuler dommerens spørsmål", "judge_panel", "Simuler dommerens kritiske spørsmål basert på saken.", "has_sources"),
      action("Angrip saken som motpart", "opposing_counsel", "Vær motpartens advokat og angrip saken.", "has_sources"),
      action("Lag kryssforhør", "cross_examination", "Lag kryssforhør med formål, kildegrunnlag og risiko.", "has_sources"),
      action("Test prosedyren", "closing_argument_test", "Test prosedyren og finn svake punkter.", "preliminary_ready"),
    ],
  },
  trial_hearing: {
    label: "Simulert hovedforhandling",
    description: "Simulerer hovedforhandlingens struktur og prosessuelle presspunkter.",
    retrievalStrategy: "Bruk kildeklare fakta, kronologi, bevis, anførsler, motargumenter og åpne risikopunkter.",
    answerStructure: "Simulert hovedforhandling med rettens innledning, innledningsforedrag, forklaringer, dokumentasjon, prosedyre, spørsmål og risikovurdering.",
    sourceRequirements: "Full simulering krever draft-ready grunnlag og kildeklare hovedpunkter.",
    uncertaintyHandling: "Marker alle hypoteser, manglende rettskilder og prosessuelle forbehold.",
    requiredReadiness: "draft_ready",
    formalOutput: true,
    nextSuggestedActions: [
      action("Simuler dommerspørsmål etter innledningen", "judge_panel", "Simuler dommerspørsmål etter innledningsforedraget.", "has_sources"),
      action("Test prosedyren", "closing_argument_test", "Test prosedyren mot hovedforhandlingens svake punkter.", "preliminary_ready"),
      action("Kjør motpartens angrep", "opposing_counsel", "Simuler motpartens angrep etter hovedforhandling.", "has_sources"),
      action("Endelig prosesskontroll", "final_litigation_quality_check", "Kjør streng prosesskontroll før faktisk bruk.", "draft_ready"),
    ],
  },
  judge_panel: {
    label: "Dommerpanel",
    description: "Simulerer kritiske spørsmål fra retten.",
    retrievalStrategy: "Finn faktum, rettslig grunnlag, bevis, motstrid, frister og kildehull dommeren sannsynlig vil presse på.",
    answerStructure: "DOMMERSPØRSMÅL med formål, hva spørsmålet tester, kilde-/kontrollbehov og anbefalt forberedelse.",
    sourceRequirements: "Spørsmål må bygge på dokumenterte kilder eller markeres som hypotetisk kontrollspørsmål.",
    uncertaintyHandling: "Ikke anta hva retten vil mene. Marker spørsmål som simulert presspunkt.",
    requiredReadiness: "has_sources",
    formalOutput: true,
    nextSuggestedActions: [
      action("Angrip saken som motpart", "opposing_counsel", "Simuler motpartens angrep på de samme punktene.", "has_sources"),
      action("Lag svarforberedelse til dommeren", "closing_argument_test", "Forbered svar på dommerspørsmålene.", "preliminary_ready"),
      action("Lag kryssforhør fra svake punkter", "cross_examination", "Lag kryssforhør basert på dommerens svake punkter.", "has_sources"),
      action("Kjør prosesskontroll", "final_litigation_quality_check", "Kjør streng prosesskontroll før bruk.", "draft_ready"),
    ],
  },
  opposing_counsel: {
    label: "Motpartens advokat",
    description: "Simulerer motpartens beste angrep på saken.",
    retrievalStrategy: "Se etter alternative forklaringer, svake bevis, prosessinnsigelser, frister, årsakssammenheng og uklare krav.",
    answerStructure: "Motpartens mulige linje, angrepspunkter, prosessuell bruk, kildegrunnlag, risiko og tiltak.",
    sourceRequirements: "Angrep skal knyttes til kilder eller tydelige hull i dokumentgrunnlaget.",
    uncertaintyHandling: "Skill mellom dokumentert motbevis, mulig tolkning og rent hypotetisk angrep.",
    requiredReadiness: "has_sources",
    formalOutput: true,
    nextSuggestedActions: [
      action("Forbered svar på motpartens angrep", "closing_argument_test", "Forbered svar på motpartens sterkeste angrep.", "preliminary_ready"),
      action("Finn bevis som tetter hull", "evidence", "Finn bevis som kan tette hullene motparten angriper.", "has_sources"),
      action("Simuler dommeren etter angrepet", "judge_panel", "Simuler hvilke dommerspørsmål angrepet utløser.", "has_sources"),
      action("Vurder forlikspress", "settlement_simulation", "Vurder forlikspress etter motpartens angrep.", "preliminary_ready"),
    ],
  },
  cross_examination: {
    label: "Kryssforhør",
    description: "Lager kryssforhør med formål, kildegrunnlag, risiko og oppfølging.",
    retrievalStrategy: "Bruk kronologi, motstrid, bevis, aktører, dokumentdatoer og svakheter i forklaring.",
    answerStructure: "KRYSSFORHØR med tema, spørsmål, formål, kildegrunnlag, risiko og oppfølgingsspørsmål.",
    sourceRequirements: "Spørsmål som konfronterer vitne eller motpart må ha kilde eller tydelig kontrollbehov.",
    uncertaintyHandling: "Marker spørsmål som kan åpne for uønsket forklaring eller krever dokumentkontroll.",
    requiredReadiness: "has_sources",
    formalOutput: true,
    nextSuggestedActions: [
      action("Lag direkte eksaminasjon for eget vitne", "direct_examination", "Lag direkte eksaminasjon for eget vitne eller klient.", "has_sources"),
      action("Finn risiko i spørsmålene", "risk", "Finn risiko i kryssforhøret.", "preliminary_ready"),
      action("Knytt spørsmål til bevis", "evidence", "Knytt kryssforhørsspørsmålene til bevis.", "has_sources"),
      action("Test spørsmålene mot motparten", "opposing_counsel", "Simuler motpartens reaksjon på kryssforhøret.", "has_sources"),
    ],
  },
  direct_examination: {
    label: "Direkte eksaminasjon",
    description: "Lager ikke-ledende spørsmål for klient eller vitne.",
    retrievalStrategy: "Bruk kronologi, dokumentkoblinger, egne bevis og åpne forklaringspunkter.",
    answerStructure: "DIREKTE EKSAMINASJON med mål, temaer, spørsmål, dokumentkobling og risiko.",
    sourceRequirements: "Spørsmål skal knyttes til dokumentert faktum der det finnes, og ellers markeres som vitneforklaring som må bevisføres.",
    uncertaintyHandling: "Marker ledende formuleringer, overdrivelser og uavklarte faktapunkter.",
    requiredReadiness: "has_sources",
    formalOutput: true,
    nextSuggestedActions: [
      action("Lag kryssforhør mot samme tema", "cross_examination", "Lag kryssforhør som tester samme tema.", "has_sources"),
      action("Koble forklaring til dokumentbevis", "evidence", "Koble vitneforklaringen til dokumentbevis.", "has_sources"),
      action("Simuler dommerens oppfølgingsspørsmål", "judge_panel", "Simuler dommerens oppfølgingsspørsmål.", "has_sources"),
      action("Finn risiko i forklaringen", "risk", "Finn risiko i direkte eksaminasjon.", "preliminary_ready"),
    ],
  },
  closing_argument_test: {
    label: "Prosedyretest",
    description: "Tester prosedyre og sluttargumentasjon mot dommer, motpart og kildegrunnlag.",
    retrievalStrategy: "Kombiner kildeklare fakta, anførsler, rettskildebehov, motargumenter og svak bevisdekning.",
    answerStructure: "PROSEDYRETEST med sterkeste punkt, svakeste punkt, dommerspørsmål, motpartens replikk, justering og kontrollbehov.",
    sourceRequirements: "Faktiske premisser må ha kilde. Rettskilder må merkes for autoritativ verifisering.",
    uncertaintyHandling: "Toner ned argumenter som mangler kilde, rettskildekontroll eller prosessuell avklaring.",
    requiredReadiness: "preliminary_ready",
    formalOutput: true,
    nextSuggestedActions: [
      action("Simuler dommerens kritiske spørsmål", "judge_panel", "Simuler dommerens spørsmål til prosedyren.", "has_sources"),
      action("Kjør motpartens replikk", "opposing_counsel", "Simuler motpartens sannsynlige replikk.", "has_sources"),
      action("Finn hvilke bevis som må styrkes", "evidence", "Finn bevis som må styrkes før prosedyre.", "has_sources"),
      action("Simuler dom", "judgment_simulation", "Simuler domsresonnement basert på kontrollert grunnlag.", "draft_ready"),
    ],
  },
  judgment_simulation: {
    label: "Simulert dom",
    description: "Simulerer hvordan en dom kan resonneres, uten å predikere utfallet.",
    retrievalStrategy: "Bruk bare kildeklare hovedfakta, kontrollerte motargumenter, rettskildebehov og åpne risikopunkter.",
    answerStructure: "SIMULERT DOM med tydelig varsel, mulig resultat, begrunnelse, avgjørende momenter, endringspunkter og hva som må styrkes.",
    sourceRequirements: "Krever draft-ready grunnlag. Alle faktiske premisser må spores til kilder.",
    uncertaintyHandling: "Må uttrykkelig si at dette ikke er prediksjon eller garanti.",
    requiredReadiness: "draft_ready",
    formalOutput: true,
    nextSuggestedActions: [
      action("Finn hva som kan endre utfallet", "risk", "Finn punkter som kan endre simulert resultat.", "preliminary_ready"),
      action("Kjør motpartens angrep på domsgrunnlaget", "opposing_counsel", "Angrip domsgrunnlaget som motpart.", "has_sources"),
      action("Kjør prosesskontroll", "final_litigation_quality_check", "Kjør endelig prosesskontroll.", "draft_ready"),
      action("Vurder forlik etter domssimulering", "settlement_simulation", "Vurder forliksspor etter domssimulering.", "preliminary_ready"),
    ],
  },
  settlement_simulation: {
    label: "Forlikssimulering",
    description: "Simulerer forhandlingsrom, presspunkter og uavklarte forhold uten garantier.",
    retrievalStrategy: "Bruk bevisstyrke, prosessrisiko, kostnadspress, uavklarte faktum og motpartens sannsynlige presspunkter.",
    answerStructure: "FORLIKSSIMULERING med beste realistiske utfall, sannsynlig sone hvis grunnlag finnes, presspunkter, prosesskostnadsrisiko, strategi og ikke-avklarte forhold.",
    sourceRequirements: "Tall, krav og presspunkter må ha kilde eller markeres som antakelse.",
    uncertaintyHandling: "Ikke garanter økonomisk eller juridisk utfall. Marker forlikssone som usikker beslutningsstøtte.",
    requiredReadiness: "preliminary_ready",
    formalOutput: true,
    nextSuggestedActions: [
      action("Finn motpartens presspunkt", "opposing_counsel", "Finn motpartens sterkeste presspunkt i forlik.", "has_sources"),
      action("Finn vår pressfaktor", "evidence", "Finn dokumenterte pressfaktorer for vår side.", "has_sources"),
      action("Lag risikomatrise for forlik", "risk", "Lag risikomatrise for forlik.", "preliminary_ready"),
      action("Test prosedyre før forlikstilbud", "closing_argument_test", "Test prosedyren før forlikstilbud.", "preliminary_ready"),
    ],
  },
  roleplay: {
    label: "Rollemodus",
    description: "Kjører rollebasert rettssakstrening.",
    retrievalStrategy: "Velg rolle ut fra brukerens språk og bruk relevante kilder, hull og risikopunkter for responsadferd.",
    answerStructure: "Rolle, intensitet, simulerte replikker/spørsmål, hva rollen tester, kildestatus, risiko og ny runde.",
    sourceRequirements: "Rollen må skille dokumentert faktum fra hypotetisk trening.",
    uncertaintyHandling: "Hold simuleringen som trening, ikke faktisk vurdering av troverdighet eller rettslig utfall.",
    requiredReadiness: "has_sources",
    formalOutput: true,
    nextSuggestedActions: [
      action("Vær dommer", "judge_panel", "Ta rollen som dommer og still kritiske spørsmål.", "has_sources"),
      action("Vær motpartens advokat", "opposing_counsel", "Ta rollen som motpartens advokat.", "has_sources"),
      action("Vær forliksmekler", "settlement_simulation", "Ta rollen som forliksmekler.", "preliminary_ready"),
      action("Vær kritisk kvalitetskontrollør", "final_litigation_quality_check", "Ta rollen som kritisk kvalitetskontrollør.", "draft_ready"),
    ],
  },
  final_litigation_quality_check: {
    label: "Endelig prosesskontroll",
    description: "Streng kvalitetskontroll før prosessuell bruk.",
    retrievalStrategy: "Kontroller kildegrunnlag, dokumenthenvisninger, rettskilder, frister, bevisrisiko, motargumenter og manuelle stoppere.",
    answerStructure: "PROSESSERT, GJENSTÅR, RISIKOVARSEL, rettskildevarsel og NESTE STEG.",
    sourceRequirements: "Alle faktiske premisser må være kildeklare; rettskilder og frister må være manuelt verifisert før faktisk bruk.",
    uncertaintyHandling: "Marker stoppere tydelig og ikke la simuleringen fremstå som godkjenning.",
    requiredReadiness: "draft_ready",
    formalOutput: true,
    nextSuggestedActions: [
      action("Vis stoppere før rettsmøte", "final_litigation_quality_check", "Vis stoppere før rettsmøte.", "draft_ready"),
      action("Kontroller dommerspørsmål", "judge_panel", "Kontroller gjenstående dommerspørsmål.", "has_sources"),
      action("Kontroller motpartens angrep", "opposing_counsel", "Kontroller motpartens sterkeste angrep.", "has_sources"),
      action("Kontroller frister og rettskilder", "quality", "Kontroller frister, rettskilder og kildehenvisninger.", "draft_ready"),
    ],
  },
};

const oldModeMap: Record<string, LegalWorkMode> = {
  free_question: "free_chat",
  find_main_tracks: "case_understanding",
  build_chronology: "chronology",
  find_contradictions: "contradictions",
  find_patterns: "crosslink",
  rank_documents: "document_ranking",
  identify_missing_information: "quality",
  prepare_controlled_draft_basis: "draft",
};

function firstSentence(value: string) {
  const sentence = value.split(/[.!?]\s/)[0] || value;
  return sentence.length > 150 ? `${sentence.slice(0, 147)}...` : sentence;
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3);
}

function scoreSource(questionTerms: string[], source: SourceObjectSummary) {
  const text = source.text_excerpt.toLowerCase();
  return questionTerms.reduce((score, term) => score + (text.includes(term) ? 1 : 0), 0);
}

function makeTurnId() {
  return `turn-${crypto.randomUUID()}`;
}

function memoryKey(caseId: string) {
  return `evida-saksrom-memory-${caseId}`;
}

function normalizeMode(value: unknown, fallback: LegalWorkMode = "free_chat"): LegalWorkMode {
  if (typeof value !== "string") {
    return fallback;
  }
  if (value in modeDefinitions) {
    return value as LegalWorkMode;
  }
  return oldModeMap[value] || fallback;
}

function normalizeReadiness(value: unknown, fallback: RequiredReadiness = "has_sources"): RequiredReadiness {
  return value === "preliminary_ready" || value === "draft_ready" || value === "has_sources"
    ? value
    : fallback;
}

function loadWorkstyle(): WorkstylePreferences {
  try {
    const raw = window.localStorage.getItem(WORKSTYLE_KEY);
    const parsed = raw ? JSON.parse(raw) as Partial<WorkstylePreferences> : {};
    const preferredMode = normalizeMode(parsed.preferredMode, defaultWorkstyle.preferredMode);
    return {
      ...defaultWorkstyle,
      ...parsed,
      preferredMode: isLitigationMode(preferredMode) ? defaultWorkstyle.preferredMode : preferredMode,
    };
  } catch {
    return defaultWorkstyle;
  }
}

function saveWorkstyle(preferences: WorkstylePreferences) {
  window.localStorage.setItem(WORKSTYLE_KEY, JSON.stringify(preferences));
}

function saveCaseMemory(caseId: string, answer: CaseAnswer) {
  const memory: CaseConversationMemory = {
    previousAssistantAnswer: answer.answer,
    suggestedActions: answer.suggestedActions,
    selectedAction: answer.selectedAction,
    retrievalSnapshot: answer.retrievalSnapshot,
    activeCollaborationMode: answer.collaborationMode,
    sourcesUsed: answer.sourceIds,
    updatedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(memoryKey(caseId), JSON.stringify(memory));
}

function loadCaseMemory(caseId: string): CaseConversationMemory | null {
  try {
    const raw = window.localStorage.getItem(memoryKey(caseId));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as CaseConversationMemory;
    return {
      ...parsed,
      activeCollaborationMode: normalizeMode(parsed.activeCollaborationMode),
    };
  } catch {
    return null;
  }
}

function createSuggestedActions(turnId: string, mode: LegalWorkMode): SuggestedAction[] {
  return modeDefinitions[mode].nextSuggestedActions.map((next, index) => ({
    ...next,
    intent: normalizeMode(next.intent),
    requiredReadiness: normalizeReadiness(next.requiredReadiness),
    id: `${turnId}-suggestion-${index + 1}`,
    index: index + 1,
    createdFromTurnId: turnId,
  }));
}

function readinessRank(level: ReadinessLevel) {
  return { no_sources: 0, has_sources: 1, preliminary_ready: 2, draft_ready: 3 }[level];
}

function requiredRank(required: RequiredReadiness) {
  return { has_sources: 1, preliminary_ready: 2, draft_ready: 3 }[required];
}

function isReadinessAllowed(level: ReadinessLevel, required: RequiredReadiness) {
  return readinessRank(level) >= requiredRank(required);
}

function getReadinessLevel(
  hasSources: boolean,
  sources: SourceObjectSummary[],
  coverage: number,
  pendingOcrPages: number,
  deviations: string[],
): ReadinessLevel {
  if (!hasSources) {
    return "no_sources";
  }
  if (coverage >= 95 && pendingOcrPages === 0 && deviations.length === 0 && sources.length >= 2) {
    return "draft_ready";
  }
  if (coverage >= 50 && sources.length >= 2) {
    return "preliminary_ready";
  }
  return "has_sources";
}

function parseCommand(raw: string): CommandDefinition | undefined {
  const value = raw.trim().toLowerCase();
  return commandDefinitions.find((command) => {
    if (value.startsWith(command.command)) {
      return true;
    }
    return command.aliases.some((alias) => value.startsWith(alias) || value.includes(alias));
  });
}

function isLitigationRequest(raw: string) {
  return /rettssimulering|rettssakssimulering|simuler dommeren|dommerpanel|motpartens advokat|angrip saken|kryssforhør|kryssforhor|direkte eksaminasjon|prosedyretest|simulert dom|domssimulering|forlikssimulering|rollespill|'prosess|'hovedforhandling|'dommer|'motpart|'kryssforhor|'direkte|'prosedyre|'dom\b|'rolle/.test(raw.toLowerCase());
}

function detectMode(question: string, fallback: LegalWorkMode): LegalWorkMode {
  const command = parseCommand(question);
  if (command) {
    return command.mode;
  }
  const value = question.toLowerCase();
  if (/rettssakssimulering|prosessforberedelse|forbered rettssak|'prosess\b/.test(value)) return "litigation_preparation";
  if (/hovedforhandling|simuler hovedforhandling|main hearing/.test(value)) return "trial_hearing";
  if (/dommerspørsmål|kritisk dommer|dommerpanel|simuler dommeren|hva ville retten spørre/.test(value)) return "judge_panel";
  if (/motpartens advokat|angrip saken|angrip anførslene|vær motpart|adversarial/.test(value)) return "opposing_counsel";
  if (/kryssforhør|kryssforhor|cross-examination|krysseksaminasjon/.test(value)) return "cross_examination";
  if (/direkte eksaminasjon|direkteeksaminasjon|ikke-ledende spørsmål|spørsmål til eget vitne/.test(value)) return "direct_examination";
  if (/prosedyretest|test prosedyren|closing argument|sluttinnlegg/.test(value)) return "closing_argument_test";
  if (/simulert dom|domssimulering|'dom\b|simuler dom|hvordan kan retten vurdere/.test(value)) return "judgment_simulation";
  if (/simuler forlik|forliksforhandling|forlikssimulering/.test(value)) return "settlement_simulation";
  if (/rollespill|roleplay|vær vitne|vær klient|vær sakkyndig/.test(value)) return "roleplay";
  if (/prosesskontroll|rettssakskontroll|prosessklar|final litigation quality/.test(value)) return "final_litigation_quality_check";
  if (/kronologi|tidslinje|hva skjedde|dato|hendelse/.test(value)) return "chronology";
  if (/bevis|dokumentasjon|underbygger|støtter/.test(value)) return "evidence";
  if (/mønster|sammenheng|går igjen|transaksjon|kontroll over|aktør/.test(value)) return "crosslink";
  if (/motstrid|motsier|avvik|stemmer ikke/.test(value)) return "contradictions";
  if (/motargument|innsigelse|svakt punkt|motpart/.test(value)) return "counterarguments";
  if (/anførsel|rettslig spørsmål|krav|påstand/.test(value)) return "claims";
  if (/rettskilde|presedens|lov|rettspraksis/.test(value)) return "legal_sources";
  if (/risiko|prosessrisiko|bevisrisiko/.test(value)) return "risk";
  if (/frist|foreldelse|søksmålsfrist/.test(value)) return "deadlines";
  if (/forlik|settlement/.test(value)) return "settlement";
  if (/utkast|prosesskriv|stevning|brev/.test(value)) return "draft";
  if (/kvalitet|kontroller|sjekk/.test(value)) return "quality";
  if (/endelig|før innsending|streng kontroll/.test(value)) return "final_control";
  if (/masker|sladd|sensitiv|rediger/.test(value)) return "redaction";
  if (/ranger|viktigste dokument|prioriter dokument/.test(value)) return "document_ranking";
  if (/strategi|taktikk|neste trekk/.test(value)) return "strategy";
  if (/bates|nummerering|referansestruktur/.test(value)) return "bates";
  if (/hovedspor|saksforståelse|hva handler saken/.test(value)) return "case_understanding";
  return fallback;
}

function resolveSuggestedAction(
  raw: string,
  suggestedActions: SuggestedAction[],
): SuggestedAction | undefined {
  const value = raw.trim().toLowerCase();
  const numberMatch =
    value.match(/^(?:nr\.?|nummer|punkt|spor|ta|velg|se på punkt|gå videre med)?\s*([1-4])\b/) ||
    value.match(/\bpunkt\s*([1-4])\b/) ||
    value.match(/\bspor\s*([1-4])\b/);
  const wordNumbers: Record<string, number> = {
    "den første": 1,
    første: 1,
    "det første": 1,
    "den andre": 2,
    andre: 2,
    "det andre": 2,
    "den tredje": 3,
    tredje: 3,
    "det tredje": 3,
    "den fjerde": 4,
    fjerde: 4,
    "det fjerde": 4,
  };
  const resolvedIndex = numberMatch
    ? Number(numberMatch[1])
    : Object.entries(wordNumbers).find(([phrase]) => value.includes(phrase))?.[1];

  return suggestedActions.find((suggestion) => suggestion.index === resolvedIndex);
}

function selectedSourcesFor(question: string, sources: SourceObjectSummary[], mode: LegalWorkMode) {
  const terms = tokenize(question);
  const limit = ["case_understanding", "chronology", "evidence", "document_ranking"].includes(mode) || isLitigationMode(mode) ? 8 : 5;
  const ranked = sources
    .map((source) => ({ source, score: scoreSource(terms, source) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return ranked.length > 0 ? ranked.map((item) => item.source) : sources.slice(0, limit);
}

function repeatedTerms(sources: SourceObjectSummary[]) {
  const counts = new Map<string, number>();
  sources.forEach((source) => {
    new Set(tokenize(source.text_excerpt)).forEach((term) => {
      counts.set(term, (counts.get(term) || 0) + 1);
    });
  });
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([term]) => term);
}

function sourceLabel(source: SourceObjectSummary, index: number) {
  return `K${index + 1}: ${source.document_id}, side ${source.page_start || "?"}`;
}

function sourceLine(source: SourceObjectSummary, index: number) {
  return `${sourceLabel(source, index)} - ${firstSentence(source.text_excerpt)}`;
}

function compactSourceRef(source: SourceObjectSummary, index: number) {
  return `K${index + 1}`;
}

function documentsRankedFromSources(sources: SourceObjectSummary[]) {
  const counts = new Map<string, number>();
  sources.forEach((source) => counts.set(source.document_id, (counts.get(source.document_id) || 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function findDateText(value: string) {
  return value.match(/\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/)?.[0] || "Udatert";
}

function controlBlock(
  documents: DocumentSummary[],
  selected: SourceObjectSummary[],
  coverage: number,
  pendingOcrPages: number,
  deviations: string[],
) {
  const pageCount = documents.reduce((sum, document) => sum + document.page_count, 0);
  const pages = selected.map((source) => source.page_start).filter(Boolean);
  const pageInterval = pages.length ? `${Math.min(...pages)}-${Math.max(...pages)}` : "Ikke fastsatt";
  return [
    "",
    "PROSESSERT",
    `- Dokumenter: ${documents.length}`,
    `- Sider: ${pageCount}`,
    `- Sideintervall: ${pageInterval}`,
    `- Dekningsgrad: ${coverage}%`,
    "",
    "GJENSTÅR",
    `- Manglende dokumenter: ${deviations.length ? deviations.join(" ") : "Ikke identifisert i denne lokale kontrollen."}`,
    `- Uavklarte faktum: ${pendingOcrPages > 0 ? `${pendingOcrPages} OCR-/tekstkontrollsider.` : "Må vurderes manuelt."}`,
    "- Rettskilder som må verifiseres: Alle rettskilder må kontrolleres i autoritativ database.",
    "- Frister som må kontrolleres: Alle frister må verifiseres manuelt.",
    "",
    "RISIKOVARSEL",
    "- Uten kilde: Ikke bruk påstander som ikke kan kobles til kilde.",
    "- Svake bevis: Se kildeutdrag og OCR-status.",
    "- Mulig motargument: Må kontrolleres før bruk.",
    "- Prosessuell risiko: Må vurderes av ansvarlig jurist.",
    "",
    "NESTE STEG",
    "- Kontroller kilder, frister og rettskilder før juridisk bruk.",
  ].join("\n");
}

function detectSimulationIntensity(question: string): SimulationIntensity {
  const value = question.toLowerCase();
  if (/dommerkritisk|kritisk dommer|dommerpanel/.test(value)) return "judge_critical";
  if (/aggressiv|hardt|skarpt|angrip/.test(value)) return "aggressive";
  if (/mild|varsomt|støttende/.test(value)) return "mild";
  return "realistic";
}

function detectLitigationRole(mode: LegalWorkMode, question: string): LitigationRole {
  const value = question.toLowerCase();
  if (mode === "judge_panel" || /dommer|retten/.test(value)) return "judge";
  if (mode === "opposing_counsel" || /motpart|innsigelse|angrip/.test(value)) return "opposing_counsel";
  if (mode === "settlement_simulation" || /forlik|mekler/.test(value)) return "mediator";
  if (mode === "final_litigation_quality_check" || /kvalitetskontroll|prosesskontroll|streng/.test(value)) return "critical_reviewer";
  if (/sakkyndig|ekspert/.test(value)) return "expert";
  if (/vitne/.test(value)) return "witness";
  if (/klient|partsforklaring/.test(value)) return "client";
  if (/lagdommer|panel/.test(value)) return "appeal_panel";
  return "own_counsel";
}

function litigationFooter(
  documents: DocumentSummary[],
  selected: SourceObjectSummary[],
  coverage: number,
  pendingOcrPages: number,
  deviations: string[],
) {
  const pageCount = documents.reduce((sum, document) => sum + document.page_count, 0);
  const pages = selected.map((source) => source.page_start).filter(Boolean);
  const pageInterval = pages.length ? `${Math.min(...pages)}-${Math.max(...pages)}` : "Ikke fastsatt";
  const documentedSources = selected.length
    ? selected.slice(0, 5).map((source, index) => `- ${sourceLine(source, index)}`).join("\n")
    : "- Ingen kildeutdrag valgt i denne runden.";

  return [
    "",
    "KILDESTATUS",
    "- Dokumenterte deler:",
    documentedSources,
    "- Brukeropplysninger: Ikke lagt til utover spørsmålet i denne runden.",
    "- Hypotetiske deler: Alle dommer-, motparts-, rolle- og forlikssimuleringer er trening/hypotese.",
    "- Manglende dokumentasjon:",
    deviations.length ? `  - ${deviations.join("\n  - ")}` : "  - Rettskilder, frister og full originalkontroll må fortsatt verifiseres manuelt.",
    "",
    "Rettskilder må verifiseres i Lovdata Pro, Rettsdata eller annen autoritativ database før bruk. Jeg kan strukturere søk og rettskildekart, men ikke garantere oppdatert rettstilstand uten tilkoblet autoritativ kilde.",
    "",
    "PROSESSERT",
    `- Dokumenter: ${documents.length}`,
    `- Sider: ${pageCount}`,
    `- Sideintervall: ${pageInterval}`,
    `- Dekningsgrad: ${coverage}%`,
    "",
    "GJENSTÅR",
    `- Manglende dokumenter: ${deviations.length ? deviations.join(" ") : "Ikke identifisert i denne lokale kontrollen."}`,
    `- Uavklarte faktum: ${pendingOcrPages > 0 ? `${pendingOcrPages} OCR-/tekstkontrollsider.` : "Må vurderes manuelt."}`,
    "- Rettskilder som må verifiseres: Alle rettslige premisser.",
    "- Frister som må kontrolleres: Alle frister og prosessuelle skjæringspunkter.",
    "",
    "RISIKOVARSEL",
    "- Uten kilde: Må støttes av dokument, vitneforklaring eller annen bevisførsel før bruk i prosess.",
    "- Svake bevis: Simuleringen kan avdekke hull, men erstatter ikke bevisvurdering.",
    "- Mulig motargument: Må testes særskilt mot motpartens beste forklaring.",
    "- Prosessuell risiko: Må vurderes av ansvarlig jurist.",
    "",
    "NESTE STEG",
    "1. Kontroller originalkilder og sidehenvisninger.",
    "2. Verifiser rettskilder og frister manuelt.",
    "3. Kjør motpart/dommerkritisk runde før faktisk bruk.",
  ].join("\n");
}

function litigationAnswerText(params: {
  mode: LegalWorkMode;
  question: string;
  selected: SourceObjectSummary[];
  documents: DocumentSummary[];
  coverage: number;
  pendingOcrPages: number;
  deviations: string[];
}) {
  const { mode, question, selected, documents, coverage, pendingOcrPages, deviations } = params;
  const intensity = detectSimulationIntensity(question);
  const role = detectLitigationRole(mode, question);
  const roleLabel = litigationRoleLabels[role];
  const intensityLabel = simulationIntensityLabels[intensity];
  const sourceRows = selected.map((source, index) => sourceLine(source, index));
  const sourceBullets = sourceRows.length ? sourceRows.map((line) => `- ${line}`).join("\n") : "- Ingen kildeutdrag valgt.";
  const firstSources = selected.slice(0, 4);
  const footer = litigationFooter(documents, selected, coverage, pendingOcrPages, deviations);
  const setup = [
    `Rolle: ${roleLabel}`,
    `Intensitet: ${intensityLabel}`,
    "Antakelse: Simuleringen bygger på lokale kildeutdrag der de finnes, og markerer resten som treningshypotese.",
  ].join("\n");

  if (mode === "litigation_preparation") {
    return [
      "RETTSAKSSIMULERING",
      "",
      setup,
      "",
      "Anbefalt forberedelsesløp:",
      "1. Lag kronologi.",
      "2. Lag bevisliste.",
      "3. Lag anførselstavle.",
      "4. Kjør motargumenter.",
      "5. Kjør kryssforhør.",
      "6. Kjør dommersimulering.",
      "7. Kjør kvalitet/endelig før bruk.",
      "",
      "Egnede neste simuleringer:",
      "1. Dommerens kritiske spørsmål.",
      "2. Motpartens beste angrep.",
      "3. Kryssforhør mot sentrale faktum.",
      "4. Prosedyretest.",
      footer,
    ].join("\n");
  }

  if (mode === "trial_hearing") {
    return [
      "SIMULERT HOVEDFORHANDLING",
      "",
      setup,
      "",
      "1. Rettens innledning",
      "Formål: Avklare prosessramme, påstander, dokumentasjon og om noe er uavklart.",
      "Presspunkt: Manglende kilde for sentrale faktum.",
      "",
      "2. Saksøkers innledningsforedrag",
      "Formål: Presentere kronologi, krav og dokumentbevis nøkternt.",
      "Kildekrav: Alle faktapåstander må knyttes til dokument og side.",
      "",
      "3. Saksøktes innledningsforedrag",
      "Presspunkt: Alternative forklaringer, reklamasjon/frister, årsakssammenheng og tap.",
      "",
      "4. Partsforklaring og vitneførsel",
      "Risiko: Forklaring som går lenger enn dokumentgrunnlaget.",
      "",
      "5. Dokumentasjon og sakkyndige",
      "Forberedelse: Marker hvilke dokumenter som faktisk beviser hvert punkt.",
      "",
      "6. Prosedyre, replikk og duplikk",
      "Forberedelse: Ha korte svar på motpartens beste angrep og dommerens nøkkelspørsmål.",
      "",
      "7. Foreløpig risikovurdering",
      pendingOcrPages > 0 ? `${pendingOcrPages} sider trenger tekst/OCR-kontroll før full simulering.` : "Hovedrisiko er rettskilder, frister og styrken i kildekoblingen.",
      footer,
    ].join("\n");
  }

  if (mode === "judge_panel") {
    return [
      "DOMMERSPØRSMÅL",
      "",
      setup,
      "",
      "1. Hvilket konkret rettslig grunnlag bygger kravet eller innsigelsen på?",
      "Tester: Om anførselen er rettslig presis og ikke bare faktisk misnøye.",
      "",
      "2. Hvilke faktiske forhold er dokumentert, og hvilke bygger på forklaring?",
      "Tester: Bevisbyrde og kildeklarhet.",
      "",
      "3. Hvor i dokumentene finner retten støtte for dette?",
      `Kildegrunnlag: ${firstSources[0] ? sourceLabel(firstSources[0], 0) : "Mangler konkret kilde i denne runden."}`,
      "",
      "4. Hva er det sterkeste motargumentet mot Deres anførsel?",
      "Tester: Om saken tåler motpartens beste versjon.",
      "",
      "5. Hvordan håndterer De motpartens dokumentasjon eller fravær av dokumentasjon?",
      "Tester: Om bevisbildet er balansert.",
      "",
      "6. Hvilke frister eller prosessuelle forutsetninger er kontrollert?",
      "Tester: Prosessuell risiko.",
      "",
      "7. Hvilke rettskilder må retten faktisk bygge på?",
      "Tester: Autoritativ rettskildekontroll.",
      footer,
    ].join("\n");
  }

  if (mode === "opposing_counsel") {
    return [
      "MOTPARTENS MULIGE LINJE",
      "",
      setup,
      "",
      "Motparten vil trolig anføre at:",
      "1. De sentrale faktiske forholdene ikke er tilstrekkelig dokumentert.",
      "2. Kildene kan tolkes annerledes eller mangler nødvendig kontekst.",
      "3. Årsakssammenheng, tap eller kravets størrelse ikke er godt nok bevist.",
      "4. Frister, reklamasjon eller prosessuelle vilkår ikke er tilstrekkelig kontrollert.",
      "5. Rettslig grunnlag ikke er presist nok for den faktiske situasjonen.",
      "",
      "Mulig prosessuell bruk:",
      "Dette bør møtes allerede i innledningsforedraget, ikke først i replikk.",
      "",
      "Kildepunkter motparten kan gripe tak i:",
      sourceBullets,
      "",
      "Anbefalt justering:",
      "- Bygg kort kildebro fra hvert hovedfaktum til dokument/side.",
      "- Lag svar på alternativ forklaring før prosedyre.",
      footer,
    ].join("\n");
  }

  if (mode === "cross_examination") {
    return [
      "KRYSSFORHØR - MOTPART/VITNE",
      "",
      setup,
      "",
      "Tema 1: Tidslinje og dokumentert kunnskap",
      "",
      "Spørsmål:",
      "1. De mottok eller kjente til det sentrale dokumentet på dette tidspunktet, korrekt?",
      "2. De ga ikke en tydelig skriftlig protest før senere?",
      "3. I mellomtiden fortsatte De handlingen eller unnlot å korrigere forholdet?",
      "4. Det finnes ingen dokumentasjon i materialet som viser en tidligere innsigelse?",
      "",
      "Formål:",
      "Etablere kunnskap, passivitet, tidslinje eller svak alternativ forklaring.",
      "",
      "Kildegrunnlag:",
      sourceBullets,
      "",
      "Risiko:",
      "Spørsmål kan åpne for muntlig forklaring, telefonsamtaler eller dokumenter som ikke er importert. Følg opp med krav om konkret dokumentasjon.",
      "",
      "Oppfølgingsspørsmål:",
      "1. Hvilket dokument viser det?",
      "2. Når ble det sendt, og til hvem?",
      "3. Hvorfor finnes ikke dette i dokumentpakken?",
      footer,
    ].join("\n");
  }

  if (mode === "direct_examination") {
    return [
      "DIREKTE EKSAMINASJON - KLIENT/VITNE",
      "",
      setup,
      "",
      "Mål:",
      "Få frem faktum kronologisk, nøkternt og dokumentnært uten ledende spørsmål.",
      "",
      "Temaer:",
      "1. Avtale eller hendelse.",
      "2. Varsel, reaksjon eller oppfølging.",
      "3. Konsekvens og dokumentasjon.",
      "",
      "Spørsmål:",
      "1. Når ble forholdet først aktuelt?",
      "2. Hva ble sagt eller avtalt?",
      "3. Hva gjorde du etterpå?",
      "4. Hvilke dokumenter viser dette?",
      "5. Hva var konsekvensen?",
      "6. Er det noe i dokumentene som kan forstås annerledes?",
      "",
      "Dokumentkobling:",
      sourceBullets,
      "",
      "Risiko:",
      "Vitnet må ikke fylle hull med sikkerhet som dokumentene ikke støtter. Skill egen opplevelse fra dokumentert faktum.",
      footer,
    ].join("\n");
  }

  if (mode === "closing_argument_test") {
    return [
      "PROSEDYRETEST",
      "",
      setup,
      "",
      "Sterkeste punkt:",
      firstSources[0] ? firstSentence(firstSources[0].text_excerpt) : "Ikke nok kildegrunnlag til å peke ut et sterkt punkt.",
      "",
      "Svakeste punkt:",
      pendingOcrPages > 0 ? `${pendingOcrPages} sider venter OCR/tekstkontroll.` : "Rettskilder, frister og motpartens beste alternative forklaring må kontrolleres.",
      "",
      "Mulig dommerspørsmål:",
      "Hvor er det konkrete dokumentgrunnlaget for den avgjørende faktapåstanden?",
      "",
      "Motpartens sannsynlige replikk:",
      "At dokumentene ikke viser det brukeren anfører, eller at årsak/frister/rettsgrunnlag er uklart.",
      "",
      "Anbefalt justering:",
      "- Prioriter dokumenterte fakta først.",
      "- Flytt usikre punkter til kontrollpunkter.",
      "- Ha kort svar på motpartens beste innsigelse.",
      "",
      "Kilde-/kontrollbehov:",
      sourceBullets,
      footer,
    ].join("\n");
  }

  if (mode === "judgment_simulation") {
    return [
      "Dette er en simulert vurdering basert på tilgjengelig dokumentgrunnlag. Det er ikke en prediksjon eller juridisk garanti.",
      "",
      "SIMULERT DOM",
      "",
      setup,
      "",
      "Resultat:",
      "Mulig utfall kan ikke fastslås. Simuleringen peker på hvilke momenter en rett kan strukturere vurderingen rundt.",
      "",
      "Begrunnelse:",
      "Retten kan legge vekt på dokumentert kronologi, bevisstyrke, rettslig grunnlag, motpartens forklaring og prosessuelle forutsetninger.",
      "",
      "Avgjørende momenter:",
      "1. Om de sentrale faktiske premissene er dokumentert.",
      "2. Om motpartens alternative forklaring svekker årsak eller ansvar.",
      "3. Om rettskilder, frister og påstand er tilstrekkelig kontrollert.",
      "",
      "Punkter som kan endre utfallet:",
      "1. Nye dokumenter eller vitneforklaringer.",
      "2. Uverifiserte rettskilder eller frister.",
      "3. Svak dokumentkobling for hovedanførselen.",
      "",
      "Hva bør styrkes før prosess:",
      "- Kildebroer fra faktum til dokument/side.",
      "- Rettskildekontroll.",
      "- Motargumenter og prosessrisiko.",
      footer,
    ].join("\n");
  }

  if (mode === "settlement_simulation") {
    return [
      "FORLIKSSIMULERING",
      "",
      setup,
      "",
      "Beste realistiske utfall:",
      "Kan ikke tallfestes uten krav/verdi og prosesskostnadsgrunnlag. Behandles som usikker beslutningsstøtte.",
      "",
      "Sannsynlig forlikssone:",
      "Må fastsettes manuelt etter bevisstyrke, kravsstørrelse, kostnadsrisiko og klientmål.",
      "",
      "Motpartens presspunkt:",
      "Uklare bevis, rettslig usikkerhet, frister, årsakssammenheng eller kostnadsrisiko.",
      "",
      "Vår pressfaktor:",
      firstSources[0] ? sourceLine(firstSources[0], 0) : "Mangler valgt kildepunkt i denne runden.",
      "",
      "Prosesskostnadsrisiko:",
      "Må vurderes manuelt. Simuleringen kan bare strukturere risikopunkter.",
      "",
      "Anbefalt strategi:",
      "Fremsett ingen tall som sikker anbefaling uten advokat- og klientkontroll. Bruk dokumenterte minimumspunkter og åpne for informasjonskrav.",
      "",
      "Ikke-avklarte forhold:",
      "- Krav/verdi, kostnader, rettskilder, frister og klientens forliksmandat.",
      footer,
    ].join("\n");
  }

  if (mode === "roleplay") {
    return [
      "ROLLEBASERT RETTSSAKSTRENING",
      "",
      setup,
      "",
      `${roleLabel}:`,
      role === "mediator"
        ? "Jeg tester forliksrom, kostnadspress og hvilke innrømmelser som kan flytte partene."
        : role === "opposing_counsel"
          ? "Jeg presser på svake bevis, alternative forklaringer, frister og uklare krav."
          : role === "judge"
            ? "Jeg stiller korte, kritiske spørsmål om rettslig grunnlag, bevis og prosess."
            : "Jeg simulerer rollen som treningspartner og markerer hva som er dokumentert, usikkert eller hypotetisk.",
      "",
      "Første runde:",
      "1. Hva er det sterkeste dokumenterte punktet ditt?",
      "2. Hva er den svakeste faktapåstanden?",
      "3. Hvilken kilde vil du vise retten først?",
      "4. Hva vil motparten si er misvisende eller ufullstendig?",
      "",
      "Kildegrunnlag:",
      sourceBullets,
      footer,
    ].join("\n");
  }

  if (mode === "final_litigation_quality_check") {
    return [
      "ENDELIG PROSESSKONTROLL",
      "",
      setup,
      "",
      "Stoppere før faktisk bruk:",
      "1. Faktapåstander uten kilde må fjernes, verifiseres eller merkes som forklaring.",
      "2. Rettskilder må kontrolleres i autoritativ database.",
      "3. Frister og prosessuelle vilkår må kontrolleres manuelt.",
      "4. Motpartens beste angrep må være besvart.",
      "5. Dokumenthenvisninger må kontrolleres mot originalside.",
      footer,
    ].join("\n");
  }

  return [
    "Rettssakssimulering",
    "",
    setup,
    "",
    "Jeg kan kjøre denne simuleringen som trening, men ikke som juridisk garanti.",
    footer,
  ].join("\n");
}

function answerTextForMode(params: {
  mode: LegalWorkMode;
  question: string;
  selected: SourceObjectSummary[];
  allSources: SourceObjectSummary[];
  documents: DocumentSummary[];
  coverage: number;
  pendingOcrPages: number;
  deviations: string[];
  workstyle: WorkstylePreferences;
}) {
  const { mode, question, selected, allSources, documents, coverage, pendingOcrPages, deviations, workstyle } = params;
  const sourceRows = selected.map((source, index) => sourceLine(source, index));
  const terms = repeatedTerms(selected.length ? selected : allSources);
  const rankedDocuments = documentsRankedFromSources(selected.length ? selected : allSources);
  const formal = modeDefinitions[mode].formalOutput;
  const maybeControl = (text: string) =>
    formal ? `${text}${controlBlock(documents, selected, coverage, pendingOcrPages, deviations)}` : text;

  if (isLitigationMode(mode)) {
    return litigationAnswerText({ mode, question, selected, documents, coverage, pendingOcrPages, deviations });
  }

  if (mode === "case_understanding") {
    return [
      "Foreløpig saksforståelse",
      "",
      `Saken ser foreløpig ut til å handle om ${terms.length ? terms.slice(0, 4).join(", ") : "temaene som går igjen i kildeutdragene"}.`,
      "",
      "Mulige arbeidsspor:",
      "1. Faktum og kronologi",
      "2. Bevis og dokumentasjon",
      "3. Mulige anførsler, risiko og åpne punkter",
      "",
      "Mulige mønstre eller forbindelser:",
      terms.length ? `- ${terms.join("\n- ")}` : "- Ingen tydelige gjentakelser funnet i første lokale pass.",
      "",
      "Usikkert eller mangler:",
      deviations.length ? `- ${deviations.join("\n- ")}` : "- Juridisk vurdering og full originalkontroll gjenstår.",
      "",
      "Kilder brukt:",
      ...sourceRows,
    ].join("\n");
  }

  if (mode === "chronology") {
    return maybeControl([
      "| Dato | Hendelse | Dokument/Kilde | Betydning | Usikkerhet |",
      "|---|---|---|---|---|",
      ...selected.map((source, index) =>
        `| ${findDateText(source.text_excerpt)} | ${firstSentence(source.text_excerpt)} | ${sourceLabel(source, index)} | Mulig kronologisk faktum | ${findDateText(source.text_excerpt) === "Udatert" ? "Må dateres" : "Middels"} |`,
      ),
    ].join("\n"));
  }

  if (mode === "evidence") {
    return maybeControl([
      "| Bevis | Hva det støtter | Kilde | Styrke | Svakhet | Bruk |",
      "|---|---|---|---|---|---|",
      ...selected.map((source, index) =>
        `| ${compactSourceRef(source, index)} | ${firstSentence(source.text_excerpt)} | ${sourceLabel(source, index)} | ${index < 2 ? "Middels" : "Foreløpig"} | Må kontrolleres mot originalsiden | Faktum/bevisliste |`,
      ),
    ].join("\n"));
  }

  if (mode === "crosslink") {
    return maybeControl([
      "| Kobling | Hvor den opptrer | Mulig betydning | Styrke | Kilder | Neste kontroll |",
      "|---|---|---|---|---|---|",
      ...(terms.length ? terms : ["ingen tydelig gjentakelse"]).map((term, index) =>
        `| ${term} | Flere lokale utdrag | Mulig undersøkelsesspor | ${index < 3 ? "Middels" : "Lav"} | ${selected.slice(0, 3).map((source, sourceIndex) => compactSourceRef(source, sourceIndex)).join(", ") || "Mangler"} | Kontroller originaltekst og aktører |`,
      ),
    ].join("\n"));
  }

  if (mode === "claims") {
    return maybeControl([
      "Anførsel 1:",
      "Mulig krav eller innsigelse må formuleres av ansvarlig jurist.",
      "",
      "Rettslig grunnlag:",
      "Må verifiseres i autoritativ rettskilde.",
      "",
      "Faktisk grunnlag:",
      ...sourceRows.map((line) => `- ${line}`),
      "",
      "Bevis som støtter:",
      selected.slice(0, 3).map((source, index) => `- ${sourceLabel(source, index)}`).join("\n") || "- Ikke nok kilder.",
      "",
      "Bevis som svekker:",
      "- Må undersøkes gjennom motargument- eller risikomodus.",
      "",
      "Motpartens sannsynlige innsigelser:",
      "- At faktum er ufullstendig dokumentert eller tolkes annerledes.",
      "",
      "Foreløpig vurdering:",
      "Middels til usikker. Bruk som arbeidsgrunnlag, ikke konklusjon.",
    ].join("\n"));
  }

  if (mode === "contradictions") {
    return maybeControl([
      "| Punkt | Kilde A | Kilde B | Mulig motstrid | Betydning | Kontrollbehov |",
      "|---|---|---|---|---|---|",
      selected.length >= 2
        ? `| 1 | ${sourceLabel(selected[0], 0)} | ${sourceLabel(selected[1], 1)} | Utdragene bør sammenlignes for avvik i faktum, dato eller forklaring | Kan påvirke bevisstyrke | Kontroller originalsider |`
        : "| 1 | Mangler | Mangler | Minst to kilder trengs | Lav | Importer eller bygg flere kilder |",
    ].join("\n"));
  }

  if (mode === "counterarguments") {
    return maybeControl([
      "| Punkt | Mulig motargument | Hva det svekker | Kildegrunnlag | Tiltak |",
      "|---|---|---|---|---|",
      ...selected.slice(0, 4).map((source, index) =>
        `| ${index + 1} | Motparten kan tolke utdraget annerledes eller hevde manglende kontekst | Faktum/årsakssammenheng | ${sourceLabel(source, index)} | Hent full dokumentkontekst og vurder motbevis |`,
      ),
    ].join("\n"));
  }

  if (mode === "legal_sources") {
    return maybeControl([
      "Rettskilder må verifiseres i autoritativ database før bruk.",
      "Jeg kan strukturere søk og rettskildekart, men ikke garantere oppdatert rettstilstand uten tilkoblet autoritativ kilde.",
      "",
      "| Tema | Mulig rettskilde | Likhet med saken | Forskjell/usikkerhet | Prosessverdi |",
      "|---|---|---|---|---|",
      `| ${terms.slice(0, 3).join(", ") || "Sakens hovedtema"} | Lov, forarbeider, rettspraksis og juridisk teori må undersøkes | Bygger på lokale faktaspor | Rettskilde ikke verifisert | Middels |`,
    ].join("\n"));
  }

  if (mode === "risk") {
    return maybeControl([
      "RISIKORAPPORT",
      "",
      "Samlet vurdering:",
      coverage >= 80 && pendingOcrPages === 0 ? "Middels prosessrisiko basert på lokalt kildegrunnlag." : "Middels til høy risiko fordi dokumentdekning eller OCR ikke er komplett.",
      "",
      "1. Bevisrisiko",
      `   Vurdering: ${selected.length >= 3 ? "Middels" : "Høy"}`,
      "   Begrunnelse: Kildegrunnlaget må kobles til konkrete faktapåstander.",
      "   Tiltak: Lag bevisliste og kontroller originale sider.",
      "",
      "2. Rettslig risiko",
      "   Vurdering: Middels",
      "   Begrunnelse: Rettskilder er ikke verifisert i autoritativ database.",
      "   Tiltak: Kjør rettskildekart og manuell kontroll.",
      "",
      "3. Fristrisiko",
      "   Vurdering: Må kontrolleres",
      "   Begrunnelse: Datoer i dokumentene kan utløse frister.",
      "   Tiltak: Kjør 'frister og kontroller manuelt.",
    ].join("\n"));
  }

  if (mode === "deadlines") {
    return maybeControl([
      "| Fristtype | Mulig dato | Grunnlag | Usikkerhet | Må kontrolleres mot | Tiltak |",
      "|---|---|---|---|---|---|",
      ...selected.map((source, index) =>
        `| Mulig prosess-/reklamasjons-/foreldelsesfrist | ${findDateText(source.text_excerpt)} | ${sourceLabel(source, index)} | Høy til dato og rettsgrunnlag er kontrollert | Lov, avtale, vedtak og prosessregler | Manuell juridisk kontroll |`,
      ),
    ].join("\n"));
  }

  if (mode === "document_ranking") {
    return maybeControl([
      "Foreløpig dokumentrangering basert på relevante kildeutdrag:",
      "",
      ...(rankedDocuments.length
        ? rankedDocuments.map(([documentId, count], index) => `${index + 1}. ${documentId}: ${count} relevante kildeutdrag. Kontrollbehov: originalside og komplett kontekst.`)
        : ["Ingen dokumenter kan rangeres uten kildeutdrag."]),
    ].join("\n"));
  }

  if (mode === "strategy") {
    return maybeControl([
      "STRATEGIOVERSIKT",
      "",
      "1. Styrende arbeidsspor",
      "- Bygg kronologi, bevisliste og motargumenter før utkast.",
      "",
      "2. Styrker",
      selected.slice(0, 2).map((source, index) => `- ${sourceLine(source, index)}`).join("\n") || "- Ikke nok kilder.",
      "",
      "3. Svakheter",
      `- ${pendingOcrPages > 0 ? `${pendingOcrPages} sider trenger OCR/tekstkontroll.` : "Rettsspørsmål og frister må verifiseres."}`,
      "",
      "4. Anbefalt neste steg",
      "- Kjør risiko, bevis og kvalitet før juridisk bruk.",
    ].join("\n"));
  }

  if (mode === "settlement") {
    return maybeControl([
      "FORLIKSVURDERING",
      "",
      "1. Forliksspor",
      "- Bruk dokumenterte hovedfakta og identifiserte svakheter som forhandlingsgrunnlag.",
      "",
      "2. Styrke",
      `- ${selected.length} kildeutdrag kan brukes som foreløpig dokumentgrunnlag.`,
      "",
      "3. Svakhet",
      "- Rettslig risiko, frister og motargumenter må kontrolleres manuelt.",
      "",
      "4. Mulig neste handling",
      "- Lag risikomatrise før forlikstilbud formuleres.",
    ].join("\n"));
  }

  if (mode === "draft") {
    return maybeControl([
      "UTKAST TIL KONTROLLERT DOKUMENTGRUNNLAG",
      "",
      "1. Innledning",
      "[Kort oversikt over saken og hva dokumentet gjelder.]",
      "",
      "2. Faktisk bakgrunn",
      ...selected.slice(0, 5).map((source, index) => `- ${firstSentence(source.text_excerpt)} [${sourceLabel(source, index)}]`),
      "",
      "3. Rettslig grunnlag",
      "[Må fylles ut etter verifisering i autoritativ rettskilde.]",
      "",
      "4. Anvendelse på saken",
      "[Bruk bare dokumenterte faktapåstander med kilde.]",
      "",
      "5. Bevis",
      selected.slice(0, 5).map((source, index) => `- ${sourceLabel(source, index)}`).join("\n"),
      "",
      "KILDEKONTROLL",
      "- Faktapåstand uten kilde: Må fylles ut etter kontroll.",
      "- Rettsspørsmål som må verifiseres: Alle.",
      "- Dokumenthenvisninger som må kontrolleres: Alle originalsider.",
    ].join("\n"));
  }

  if (mode === "quality") {
    return maybeControl([
      "KVALITETSKONTROLL",
      "",
      "Faktapåstander uten kilde:",
      "- Ikke vurdert mot konkret utkast i denne lokale visningen.",
      "",
      "Dokumenthenvisninger som må kontrolleres:",
      ...selected.slice(0, 5).map((source, index) => `- ${sourceLabel(source, index)}`),
      "",
      "For sterke formuleringer:",
      "- Alle konklusjoner må formuleres som foreløpige til ansvarlig jurist har kontrollert.",
      "",
      "Manglende motargumenter:",
      "- Kjør 'motargumenter før bruk.",
      "",
      "Rettskilder som må verifiseres:",
      "- Alle rettskilder må sjekkes i autoritativ database.",
      "",
      "Frister som må kontrolleres:",
      "- Kjør 'frister og kontroller manuelt.",
      "",
      "Anbefalt neste steg:",
      "- Kjør 'endelig når kilder, frister og rettskilder er kontrollert.",
    ].join("\n"));
  }

  if (mode === "final_control") {
    return controlBlock(documents, selected, coverage, pendingOcrPages, deviations);
  }

  if (mode === "redaction") {
    return maybeControl([
      "| Type sensitiv informasjon | Forekomst | Dokument | Side | Anbefalt handling | Risiko |",
      "|---|---|---|---|---|---|",
      ...selected.slice(0, 5).map((source, index) =>
        `| Mulig person-/klient-/tredjepartsopplysning | ${firstSentence(source.text_excerpt)} | ${source.document_id} | ${source.page_start || "?"} | Kontroller og marker for maskering, ikke destruktivt rediger uten bekreftelse | Middels |`,
      ),
    ].join("\n"));
  }

  if (mode === "bates") {
    return maybeControl([
      "| Dokument | Foreslått referanse | Sideintervall | Kortnavn | Bruk | Kontrollbehov |",
      "|---|---|---|---|---|---|",
      ...rankedDocuments.map(([documentId], index) =>
        `| ${documentId} | DOK-${String(index + 1).padStart(3, "0")} | Må verifiseres | ${documentId.slice(0, 18)} | Kilde-/bevisreferanse | Kontroller komplett sideantall |`,
      ),
    ].join("\n"));
  }

  return [
    workstyle.answerLength === "short" ? "Kort svar:" : "Sikker lokalmodus finner foreløpig dette i sakens kildeutdrag:",
    ...sourceRows,
    selected.length === 0 ? `Jeg fant ikke et tydelig kildeutdrag for spørsmålet: ${question}` : "",
  ].filter(Boolean).join("\n");
}

function blockedSuggestedActions(turnId: string, mode?: LegalWorkMode): SuggestedAction[] {
  const nextActions = mode && isLitigationMode(mode)
    ? [
        action("Simuler dommerens spørsmål først", "judge_panel", "Simuler dommerens spørsmål basert på foreløpige kilder.", "has_sources"),
        action("Angrip saken som motpart", "opposing_counsel", "Simuler motpartens beste angrep.", "has_sources"),
        action("Lag bevisrisiko", "risk", "Finn bevisrisiko som må styrkes før full simulering.", "preliminary_ready"),
        action("Hva må styrkes før domssimulering?", "litigation_preparation", "Forklar hva som må styrkes før full doms- eller hovedforhandlingssimulering.", "has_sources"),
      ]
    : [
    action("Bygg kronologi først", "chronology", "Bygg kronologi først.", "has_sources"),
    action("Lag bevisliste", "evidence", "Lag bevisliste.", "has_sources"),
    action("Finn motargumenter", "counterarguments", "Finn motargumenter og svake punkter.", "preliminary_ready"),
    action("Se kontrollgrunnlag", "case_understanding", "Forklar hva som mangler før modusen kan brukes.", "has_sources"),
  ];
  return nextActions.map((next, index) => ({
    ...next,
    id: `${turnId}-blocked-suggestion-${index + 1}`,
    index: index + 1,
    createdFromTurnId: turnId,
  }));
}

function buildBlockedAnswer(params: {
  mode: LegalWorkMode;
  question: string;
  sources: SourceObjectSummary[];
  documents: DocumentSummary[];
  coverage: number;
  deviations: string[];
  pendingOcrPages: number;
  readiness: ReadinessLevel;
  selectedAction?: SuggestedAction;
}): CaseAnswer {
  const { mode, sources, documents, coverage, deviations, pendingOcrPages, readiness, selectedAction } = params;
  const turnId = makeTurnId();
  const definition = modeDefinitions[mode];
  const selected = sources.slice(0, 3);
  const reason =
    definition.requiredReadiness === "draft_ready"
      ? isLitigationMode(mode)
        ? "Denne simuleringen krever draft-ready grunnlag: høy dekning, kildeklare hovedpunkter, ingen OCR-ventende sider og ingen åpne kontrollavvik."
        : "Modusen krever draft-ready kildegrunnlag: høy dekning, ingen OCR-ventende sider og ingen åpne kontrollavvik."
      : "Modusen krever mer foreløpig kildegrunnlag enn saken har akkurat nå.";
  const safeAlternatives = isLitigationMode(mode)
    ? [
        "1. dommerspørsmål basert på foreløpige kilder",
        "2. motpartens mulige angrep",
        "3. bevisrisiko",
        "4. hva som må styrkes før full simulering",
      ]
    : [
        "1. bygge kronologi",
        "2. lage bevisliste",
        "3. finne motargumenter eller hull",
        "4. kontrollere hva som mangler i dokumentgrunnlaget",
      ];
  return {
    turnId,
    answer: [
      `Jeg kan ikke kjøre ${definition.label} ennå.`,
      "",
      reason,
      "",
      "Jeg kan først hjelpe deg med:",
      ...safeAlternatives,
    ].join("\n"),
    sourceIds: selected.map((source) => source.id),
    validatedSources: selected.map((source) => ({
      sourceId: source.id,
      documentId: source.document_id,
      pageNumber: source.page_start,
      validationStatus: "LOCAL",
    })),
    answerStrength: {
      level: "Lav",
      reason: "Svaret er en readiness-blokkering, ikke juridisk vurdering.",
    },
    uncertainty: "Høy. Modusen er blokkert til kildegrunnlaget er bedre kontrollert.",
    missing: deviations.length ? deviations.join(" ") : "Kildeklarhet, frister, rettskilder og full dokumentdekning må kontrolleres.",
    nextStep: isLitigationMode(mode) ? "Start med dommerspørsmål, motpartens angrep eller bevisrisiko." : "Start med kronologi eller bevisliste.",
    collaborationMode: mode,
    selectedAction,
    suggestedActions: blockedSuggestedActions(turnId, mode),
    retrievalSnapshot: {
      strategy: definition.retrievalStrategy,
      candidateSourceIds: sources.slice(0, 8).map((source) => source.id),
      selectedSourceIds: selected.map((source) => source.id),
      coverage,
      pendingOcrPages,
      deviations,
      readiness,
    },
    blockedReason: reason,
  };
}

function buildAnswer(params: {
  question: string;
  sources: SourceObjectSummary[];
  documents: DocumentSummary[];
  coverage: number;
  deviations: string[];
  pendingOcrPages: number;
  nextActionTitle: string;
  mode: LegalWorkMode;
  selectedAction?: SuggestedAction;
  workstyle: WorkstylePreferences;
  readiness: ReadinessLevel;
}): CaseAnswer {
  const {
    question,
    sources,
    documents,
    coverage,
    deviations,
    pendingOcrPages,
    nextActionTitle,
    mode,
    selectedAction,
    workstyle,
    readiness,
  } = params;
  const turnId = makeTurnId();
  const definition = modeDefinitions[mode];

  if (!isReadinessAllowed(readiness, definition.requiredReadiness)) {
    return buildBlockedAnswer({ mode, question, sources, documents, coverage, deviations, pendingOcrPages, readiness, selectedAction });
  }

  const selected = selectedSourcesFor(question, sources, mode);
  const answer = answerTextForMode({ mode, question, selected, allSources: sources, documents, coverage, pendingOcrPages, deviations, workstyle });

  return {
    turnId,
    answer,
    sourceIds: selected.map((source) => source.id),
    validatedSources: selected.map((source) => ({
      sourceId: source.id,
      documentId: source.document_id,
      pageNumber: source.page_start,
      validationStatus: "LOCAL",
    })),
    answerStrength: {
      level: selected.length >= 4 && coverage >= 80 && pendingOcrPages === 0 ? "Høy" : selected.length >= 2 ? "Middels" : "Lav",
      reason: `Svaret bruker ${selected.length} lokale kildeutdrag i modusen "${definition.label}".`,
    },
    uncertainty:
      coverage < 80 || pendingOcrPages > 0
        ? "Middels til høy. Dokumentdekning eller OCR er ikke komplett."
        : definition.uncertaintyHandling,
    missing: deviations.length > 0 ? deviations.join(" ") : "Juridisk vurdering, rettskilder, frister og manuell godkjenning.",
    nextStep: nextActionTitle,
    collaborationMode: mode,
    selectedAction,
    suggestedActions: createSuggestedActions(turnId, mode),
    retrievalSnapshot: {
      strategy: definition.retrievalStrategy,
      candidateSourceIds: sources.slice(0, 12).map((source) => source.id),
      selectedSourceIds: selected.map((source) => source.id),
      coverage,
      pendingOcrPages,
      deviations,
      readiness,
    },
  };
}

function normalizeSuggestedAction(actionValue: unknown, turnId: string, index: number): SuggestedAction | null {
  if (!actionValue || typeof actionValue !== "object") {
    return null;
  }
  const actionObject = actionValue as Partial<SuggestedAction>;
  if (!actionObject.label || !actionObject.queryTemplate) {
    return null;
  }
  return {
    id: actionObject.id || `${turnId}-stored-suggestion-${index + 1}`,
    index: actionObject.index || index + 1,
    label: actionObject.label,
    intent: normalizeMode(actionObject.intent),
    queryTemplate: actionObject.queryTemplate,
    requiredReadiness: normalizeReadiness(actionObject.requiredReadiness),
    createdFromTurnId: actionObject.createdFromTurnId || turnId,
    route: actionObject.route === "litigation" ? "litigation" : undefined,
  };
}

function normalizeStoredAnswer(result: Partial<CaseAnswer>, question: string): CaseAnswer {
  const turnId = result.turnId || makeTurnId();
  const mode = normalizeMode(result.collaborationMode, detectMode(question, "free_chat"));
  const sourceIds = result.sourceIds || [];
  const suggestedActions = Array.isArray(result.suggestedActions)
    ? result.suggestedActions
        .map((item, index) => normalizeSuggestedAction(item, turnId, index))
        .filter(Boolean) as SuggestedAction[]
    : [];
  const snapshot = result.retrievalSnapshot;
  return {
    turnId,
    answer: result.answer || "Lagret svar mangler tekst.",
    sourceIds,
    validatedSources: result.validatedSources || [],
    answerStrength: result.answerStrength || {
      level: "Lav",
      reason: "Eldre lagret svar uten komplett styrkevurdering.",
    },
    uncertainty: result.uncertainty || "Ukjent. Dette er et eldre lagret svar.",
    missing: result.missing || "Ikke registrert.",
    nextStep: result.nextStep || "Velg et mulig neste spor.",
    collaborationMode: mode,
    selectedAction: result.selectedAction,
    suggestedActions: suggestedActions.length ? suggestedActions : createSuggestedActions(turnId, mode),
    retrievalSnapshot: {
      strategy: snapshot?.strategy || modeDefinitions[mode].retrievalStrategy,
      candidateSourceIds: snapshot?.candidateSourceIds || sourceIds,
      selectedSourceIds: snapshot?.selectedSourceIds || sourceIds,
      coverage: snapshot?.coverage || 0,
      pendingOcrPages: snapshot?.pendingOcrPages || 0,
      deviations: snapshot?.deviations || [],
      readiness: snapshot?.readiness || "has_sources",
    },
    blockedReason: result.blockedReason,
  };
}

function parseStoredAnswer(message: CaseAiMessageDto): { question: string; result: CaseAnswer } | null {
  const raw = message.answer_json || message.content;
  try {
    const parsed = JSON.parse(raw) as { question?: string; result?: Partial<CaseAnswer> };
    if (!parsed.question || !parsed.result) {
      return null;
    }
    return {
      question: parsed.question,
      result: normalizeStoredAnswer(
        {
          ...parsed.result,
          validatedSources: message.sources.map((source) => ({
            sourceId: source.source_id,
            documentId: source.document_id,
            pageNumber: source.page_number,
            validationStatus: source.validation_status,
          })),
        },
        parsed.question,
      ),
    };
  } catch {
    return null;
  }
}

function caseUnderstandingLead(sources: SourceObjectSummary[], hasSources: boolean) {
  if (!hasSources) {
    return "Importer eller klargjør dokumenter først. Saksrom åpner analyse når saken har sporbare kildeutdrag.";
  }
  const terms = repeatedTerms(sources);
  return `Jeg har begynt å lese saken og laget en første oversikt basert på kildene som er klare. Saken ser foreløpig ut til å handle om ${
    terms.length ? terms.slice(0, 4).join(", ") : "temaene som går igjen i de importerte dokumentene"
  }.`;
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function CaseRoomView({
  selectedCase,
  documents,
  sources,
  sourcesById,
  pendingOcrPages,
  coverage,
  deviations,
  readinessVerdict,
  nextActionTitle,
  onOpenSource,
  onOpenControl,
  onOpenLitigation,
}: CaseRoomViewProps) {
  const [question, setQuestion] = useState("");
  const [answers, setAnswers] = useState<Array<{ question: string; result: CaseAnswer }>>([]);
  const [isAsking, setIsAsking] = useState(false);
  const [providerNotice, setProviderNotice] = useState("");
  const [workstyle, setWorkstyle] = useState<WorkstylePreferences>(() => loadWorkstyle());
  const [activeMode, setActiveMode] = useState<LegalWorkMode>(workstyle.preferredMode);
  const [workStateIndex, setWorkStateIndex] = useState(0);
  const [streamingDraft, setStreamingDraft] = useState<{ question: string; text: string; mode: LegalWorkMode } | null>(null);

  const hasSources = sources.length > 0;
  const hasDocuments = documents.length > 0;
  const totalPages = documents.reduce((sum, document) => sum + document.page_count, 0);
  const processedDocuments = documents.filter((document) => document.source_count > 0 || document.analyzed_page_count > 0);
  const readiness = getReadinessLevel(hasSources, sources, coverage, pendingOcrPages, deviations);
  const canAsk = Boolean(selectedCase?.id && hasSources);
  const isIncomplete = !hasSources || coverage < 95 || pendingOcrPages > 0 || deviations.length > 0;
  const latestAnswer = answers[0]?.result;
  const latestSuggestedActions = latestAnswer?.suggestedActions || [];
  const visibleAnswers = [...answers].reverse();
  const activeModeDefinition = modeDefinitions[activeMode];
  const activeWorkStates = workStatesForMode(activeMode);
  const modeOptions = useMemo(
    () => (Object.entries(modeDefinitions) as Array<[LegalWorkMode, ModeDefinition]>).filter(([key]) => !isLitigationMode(key)),
    [],
  );
  const primaryShortcuts = commandDefinitions.filter((command) =>
    ["'kronologi", "'bevis", "'risiko", "'kvalitet"].includes(command.command),
  );

  useEffect(() => {
    saveWorkstyle(workstyle);
  }, [workstyle]);

  useEffect(() => {
    if (!selectedCase?.id) {
      setAnswers([]);
      return;
    }
    const memory = loadCaseMemory(selectedCase.id);
    if (memory) {
      setActiveMode(memory.activeCollaborationMode);
    } else {
      setActiveMode(workstyle.preferredMode);
    }
    listCaseAiMessages(selectedCase.id)
      .then((messages) => setAnswers(messages.map(parseStoredAnswer).filter(Boolean) as Array<{ question: string; result: CaseAnswer }>))
      .catch(() => setAnswers([]));
  }, [selectedCase?.id, workstyle.preferredMode]);

  function updateWorkstyle(patch: Partial<WorkstylePreferences>) {
    setWorkstyle((current) => ({ ...current, ...patch }));
  }

  function resolveTurn(rawQuestion: string, explicitAction?: SuggestedAction) {
    const resolvedAction = explicitAction || resolveSuggestedAction(rawQuestion, latestSuggestedActions);
    const asksForSources = /kilde|kilder|sitat|side|utdrag/.test(rawQuestion.toLowerCase());
    const command = parseCommand(rawQuestion);
    const displayQuestion = resolvedAction
      ? asksForSources
        ? `Vis kildene for ${resolvedAction.index}. ${resolvedAction.label}`
        : resolvedAction.label
      : rawQuestion.trim();
    const query = resolvedAction
      ? asksForSources
        ? `Vis kildene for sporet: ${resolvedAction.queryTemplate}`
        : resolvedAction.queryTemplate
      : rawQuestion.trim();
    const mode = resolvedAction?.intent || command?.mode || detectMode(query, activeMode || workstyle.preferredMode);
    return { resolvedAction, displayQuestion, query, mode };
  }

  async function revealAnswer(questionText: string, answerText: string, mode: LegalWorkMode) {
    setStreamingDraft({ question: questionText, text: "", mode });
    const chunks = answerText.match(/[\s\S]{1,220}/g) || [answerText];
    let next = "";
    for (const chunk of chunks) {
      next += chunk;
      setStreamingDraft({ question: questionText, text: next, mode });
      await sleep(18);
    }
  }

  async function persistAnswer(displayQuestion: string, result: CaseAnswer) {
    if (!selectedCase?.id) {
      return { question: displayQuestion, result };
    }
    const answerJson = JSON.stringify({
      question: displayQuestion,
      result,
      model_id: "safe-local-source-mode",
      prompt_version: "case_room_adaptive_litigation_v3",
      source_index_version: `sources-${sources.length}`,
    });
    const persisted = await recordCaseAiExchange({
      caseId: selectedCase.id,
      question: displayQuestion,
      answerJson,
      sourceIds: result.sourceIds,
      modelId: "safe-local-source-mode",
      promptVersion: "case_room_adaptive_litigation_v3",
      sourceIndexVersion: `sources-${sources.length}`,
    });
    return parseStoredAnswer(persisted) || { question: displayQuestion, result };
  }

  async function submitTurn(rawQuestion: string, explicitAction?: SuggestedAction) {
    if (!selectedCase?.id || !canAsk) {
      return;
    }
    const { resolvedAction, displayQuestion, query, mode } = resolveTurn(rawQuestion, explicitAction);
    if (!query.trim()) {
      return;
    }
    if (resolvedAction?.route === "litigation" || isLitigationRequest(rawQuestion)) {
      onOpenLitigation(resolvedAction ? `${displayQuestion}: ${resolvedAction.queryTemplate}` : rawQuestion.trim());
      setQuestion("");
      return;
    }

    setIsAsking(true);
    setProviderNotice("");
    setActiveMode(mode);
    setWorkStateIndex(0);
    const turnWorkStates = workStatesForMode(mode);
    const interval = window.setInterval(() => {
      setWorkStateIndex((current) => Math.min(current + 1, turnWorkStates.length - 1));
    }, 280);

    try {
      const required = modeDefinitions[mode].requiredReadiness;
      const shouldUseProvider = isReadinessAllowed(readiness, required);
      if (shouldUseProvider) {
        try {
          const providerMessage = await askCaseAi({
            caseId: selectedCase.id,
            question: query,
            coverage,
            pendingOcrPages,
            deviations,
            nextActionTitle,
          });
          const providerAnswer = parseStoredAnswer(providerMessage);
          if (providerAnswer) {
            const enrichedResult = normalizeStoredAnswer(
              {
                ...providerAnswer.result,
                collaborationMode: mode,
                selectedAction: resolvedAction,
                suggestedActions: providerAnswer.result.suggestedActions?.length
                  ? providerAnswer.result.suggestedActions
                  : createSuggestedActions(providerAnswer.result.turnId, mode),
              },
              displayQuestion,
            );
            await revealAnswer(displayQuestion, enrichedResult.answer, mode);
            const entry = { question: displayQuestion, result: enrichedResult };
            setAnswers((current) => [entry, ...current].slice(0, 30));
            saveCaseMemory(selectedCase.id, enrichedResult);
            setQuestion("");
            setStreamingDraft(null);
            return;
          }
          setProviderNotice("Sikker lokalmodus aktiv: ekstern AI svarte ikke med gyldig struktur, så Evida bruker lokale kildeutdrag.");
        } catch {
          setProviderNotice("Sikker lokalmodus aktiv: ekstern AI er av eller utilgjengelig. Evida bruker bare lokale kildeutdrag fra saken.");
        }
      }

      const result = buildAnswer({
        question: query,
        sources,
        documents,
        coverage,
        deviations,
        pendingOcrPages,
        nextActionTitle,
        mode,
        selectedAction: resolvedAction,
        workstyle,
        readiness,
      });
      await revealAnswer(displayQuestion, result.answer, mode);
      const entry = await persistAnswer(displayQuestion, result);
      setAnswers((current) => [entry, ...current].slice(0, 30));
      saveCaseMemory(selectedCase.id, entry.result);
      setQuestion("");
    } finally {
      window.clearInterval(interval);
      setWorkStateIndex(turnWorkStates.length - 1);
      setIsAsking(false);
      setStreamingDraft(null);
    }
  }

  function renderSources(entry: CaseAnswer) {
    if (entry.validatedSources.length === 0) {
      return <p className="muted">Mangler kilde.</p>;
    }
    return (
      <div className="case-source-list">
        {entry.validatedSources.map((sourceRef) => {
          const source = sourcesById.get(sourceRef.sourceId);
          return (
            <button
              key={sourceRef.sourceId}
              type="button"
              className="case-source-pill"
              onClick={() => onOpenSource(sourceRef.sourceId)}
            >
              <strong>{sourceRef.documentId} · side {sourceRef.pageNumber || "?"}</strong>
              <span>{source ? firstSentence(source.text_excerpt) : "Kilde mangler i lokal indeks."}</span>
            </button>
          );
        })}
      </div>
    );
  }

  function renderSuggestedActions(entry: CaseAnswer) {
    if (!workstyle.showSuggestions || entry.suggestedActions.length === 0) {
      return null;
    }
    return (
      <div className="case-next-tracks">
        <strong>Mulige neste spor å undersøke videre</strong>
        <div className="case-next-track-list">
          {entry.suggestedActions.map((suggestion) => (
            <button
              key={suggestion.id}
              type="button"
              className="case-next-track-button"
              onClick={() =>
                suggestion.route === "litigation"
                  ? onOpenLitigation(`${entry.collaborationMode}: ${suggestion.queryTemplate}`)
                  : void submitTurn(suggestion.label, suggestion)
              }
            >
              <span>{suggestion.index}</span>
              {suggestion.label}
            </button>
          ))}
        </div>
        <p>Du kan også spørre fritt.</p>
      </div>
    );
  }

  function renderAnswerDetails(entry: CaseAnswer) {
    const definition = modeDefinitions[entry.collaborationMode];
    return (
      <details className="case-answer-details">
        <summary>Kilder, usikkerhet og neste steg</summary>
        <div className="case-answer-meta">
          <p><strong>Modus:</strong> {definition.label}</p>
          <p><strong>Retrieval:</strong> {entry.retrievalSnapshot.strategy}</p>
          <p><strong>Svarstruktur:</strong> {definition.answerStructure}</p>
          <p><strong>Kildekrav:</strong> {definition.sourceRequirements}</p>
          <p><strong>Usikkerhetshåndtering:</strong> {definition.uncertaintyHandling}</p>
          <p><strong>Readiness:</strong> {entry.retrievalSnapshot.readiness}</p>
          <p><strong>Svarstyrke:</strong> {entry.answerStrength.level}: {entry.answerStrength.reason}</p>
          <p><strong>Usikkerhet:</strong> {entry.uncertainty}</p>
          <p><strong>Hva mangler:</strong> {entry.missing}</p>
          <p><strong>Neste steg:</strong> {entry.nextStep}</p>
          {entry.blockedReason ? <p><strong>Blokkert:</strong> {entry.blockedReason}</p> : null}
        </div>
        {workstyle.citationPlacement === "assessment_first" ? renderSources(entry) : null}
      </details>
    );
  }

  const lead = caseUnderstandingLead(sources, hasSources);

  return (
    <section className="case-chat-shell">
      <div className="case-chat-scroll">
        <header className="case-chat-header">
          <p className="eyebrow">Saksrom</p>
          <h2>{selectedCase?.name || "Valgt sak"}</h2>
          <div className="case-summary-card">
            <div className="mode-line">
              <span className="local-pill">Sikker lokalmodus</span>
              <span>Aktiv modus: {activeModeDefinition.label}</span>
              <span>{readinessVerdict.label}</span>
            </div>
            <div className={`readiness-verdict readiness-verdict--${readinessVerdict.status}`}>
              <strong>{readinessVerdict.label}</strong>
              <span>{readinessVerdict.description}</span>
              <small>{readinessVerdict.detail}</small>
            </div>
            <h3>Foreløpig saksforståelse</h3>
            <p>{lead}</p>
            <div className="case-understanding-grid">
              <article>
                <strong>Hovedspor</strong>
                <span>Faktum og kronologi</span>
                <span>Bevis og dokumentasjon</span>
                <span>Anførsler, risiko og åpne punkter</span>
              </article>
              <article>
                <strong>Mulige forbindelser</strong>
                {(repeatedTerms(sources).slice(0, 4).length ? repeatedTerms(sources).slice(0, 4) : ["Ingen tydelige mønstre ennå"]).map((term) => (
                  <span key={term}>{term}</span>
                ))}
              </article>
              <article>
                <strong>Usikkert</strong>
                <span>{pendingOcrPages > 0 ? `${pendingOcrPages} sider trenger OCR/tekstkontroll` : "Frister og rettskilder må kontrolleres manuelt"}</span>
                <span>{coverage}% kildeklar dekning</span>
              </article>
            </div>
            <p className="case-free-chat-hint">Du kan spørre fritt, velge et spor, bruke en kommando, eller skrive 1-4 etter forslagene.</p>
            <details className="case-technical-summary">
              <summary>Kontrollmetadata</summary>
              <ul className="case-summary-list">
                <li>{documents.length} dokumenter, {totalPages} PDF-sider og {processedDocuments.length} dokumenter ferdig behandlet.</li>
                <li>{hasSources ? `${sources.length} kildeutdrag er klare for spørsmål og kontroll.` : "Ingen brukbare kildeutdrag ennå."}</li>
                <li>{deviations.length ? deviations.join(" ") : "Ingen avvik registrert i denne visningen."}</li>
              </ul>
            </details>
            {isIncomplete ? (
              <div className="case-soft-warning">
                <span>Dokumentgrunnlaget er ikke komplett. Svar kan være ufullstendige.</span>
                <button type="button" className="button-secondary" onClick={onOpenControl}>
                  Se kontrollgrunnlag
                </button>
              </div>
            ) : null}
            <details className="workstyle-panel">
              <summary>Tilpass Saksrom til måten jeg jobber på</summary>
              <div className="workstyle-grid">
                <label>
                  Svarlengde
                  <select value={workstyle.answerLength} onChange={(event) => updateWorkstyle({ answerLength: event.target.value as AnswerLength })}>
                    <option value="short">Korte svar</option>
                    <option value="balanced">Balanserte svar</option>
                    <option value="detailed">Detaljerte svar</option>
                  </select>
                </label>
                <label>
                  Struktur
                  <select value={workstyle.preferredStructure} onChange={(event) => updateWorkstyle({ preferredStructure: event.target.value as PreferredStructure })}>
                    <option value="bullets">Punktliste</option>
                    <option value="narrative">Narrativ</option>
                    <option value="table">Tabell</option>
                    <option value="mixed">Blandet</option>
                  </select>
                </label>
                <label>
                  Kildeplassering
                  <select value={workstyle.citationPlacement} onChange={(event) => updateWorkstyle({ citationPlacement: event.target.value as CitationPlacement })}>
                    <option value="assessment_first">Vurdering først</option>
                    <option value="sources_first">Kilder først</option>
                  </select>
                </label>
                <label>
                  Foretrukket arbeidsmodus
                  <select value={workstyle.preferredMode} onChange={(event) => updateWorkstyle({ preferredMode: event.target.value as LegalWorkMode })}>
                    {modeOptions.map(([key, definition]) => (
                      <option key={key} value={key}>{definition.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Språknivå
                  <select value={workstyle.legalLanguageLevel} onChange={(event) => updateWorkstyle({ legalLanguageLevel: event.target.value as WorkstylePreferences["legalLanguageLevel"] })}>
                    <option value="plain">Klart språk</option>
                    <option value="professional">Profesjonelt</option>
                    <option value="technical">Teknisk juridisk</option>
                  </select>
                </label>
                <label className="workstyle-toggle">
                  <input type="checkbox" checked={workstyle.showSuggestions} onChange={(event) => updateWorkstyle({ showSuggestions: event.target.checked })} />
                  Vis alltid neste spor
                </label>
                <label className="workstyle-toggle">
                  <input type="checkbox" checked={workstyle.showWorkStates} onChange={(event) => updateWorkstyle({ showWorkStates: event.target.checked })} />
                  Vis arbeidstrinn mens Evida svarer
                </label>
                <label className="workstyle-toggle">
                  <input type="checkbox" checked={workstyle.showDetailedWorkStates} onChange={(event) => updateWorkstyle({ showDetailedWorkStates: event.target.checked })} />
                  Vis detaljerte arbeidsstater
                </label>
              </div>
              <p>Tilpasningen lagres lokalt. Saksfakta, klientopplysninger og juridiske konklusjoner brukes ikke på tvers av saker.</p>
            </details>
          </div>
        </header>

        <div className="case-chat-messages">
          {visibleAnswers.length === 0 && !streamingDraft ? (
            <div className="case-empty-chat">
              <h3>Spør saken</h3>
              <p>Still spørsmål om dokumentene. Svar viser kilder, usikkerhet og hva som mangler.</p>
              <div className="suggested-question-list suggested-question-list--centered">
                {["Hva handler saken om?", "'kronologi", "'bevis", "'risiko", "'kvalitet"].map((suggestion) => (
                  <button key={suggestion} type="button" className="button-ghost" onClick={() => setQuestion(suggestion)}>
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {visibleAnswers.map((entry, index) => (
            <article key={`${entry.result.turnId}-${index}`} className="case-message-group">
              <div className="case-message case-message--user">{entry.question}</div>
              <div className="case-message case-message--assistant">
                {workstyle.citationPlacement === "sources_first" ? renderSources(entry.result) : null}
                <p className="case-answer-text">{entry.result.answer}</p>
                {renderAnswerDetails(entry.result)}
                {renderSuggestedActions(entry.result)}
              </div>
            </article>
          ))}
          {streamingDraft ? (
            <article className="case-message-group">
              <div className="case-message case-message--user">{streamingDraft.question}</div>
              <div className="case-message case-message--assistant">
                <p className="case-answer-text">{streamingDraft.text}</p>
              </div>
            </article>
          ) : null}
          {isAsking && workstyle.showWorkStates ? (
            <div className="assistant-work-state" role="status">
              {activeWorkStates.map((state, index) => (
                <span key={state} className={index <= workStateIndex ? "is-active" : ""}>
                  {state}
                </span>
              ))}
              {workstyle.showDetailedWorkStates ? <p>{activeModeDefinition.retrievalStrategy}</p> : null}
            </div>
          ) : null}
          {providerNotice ? <div className="case-provider-notice">{providerNotice}</div> : null}
        </div>
      </div>

      <form
        className="case-chat-composer"
        onSubmit={(event) => {
          event.preventDefault();
          void submitTurn(question);
        }}
      >
        <div className="case-chat-input-stack">
          <div className="case-chat-shortcuts">
            <span>Snarveier:</span>
            {primaryShortcuts.map((shortcut) => (
              <button key={shortcut.command} type="button" className="link-button" onClick={() => setQuestion(shortcut.command)}>
                {shortcut.command}
              </button>
            ))}
          </div>
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void submitTurn(question);
              }
            }}
            placeholder={canAsk ? "Spør fritt, velg et spor, eller skriv 1-4" : "Saksrom trenger brukbare kildeutdrag før du kan spørre fritt"}
            rows={1}
            disabled={!canAsk || isAsking}
          />
        </div>
        <button type="submit" className="button-primary" disabled={!question.trim() || !selectedCase?.id || !canAsk || isAsking}>
          {isAsking ? "Svarer ..." : "Send"}
        </button>
      </form>
    </section>
  );
}
