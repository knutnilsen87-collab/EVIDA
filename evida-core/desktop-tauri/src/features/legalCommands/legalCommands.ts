import type { CaseReadinessVerdict, CaseReadinessSeverity } from "../readiness/caseReadiness";

export type LegalCommandId =
  | "chronology"
  | "crosslink"
  | "evidence"
  | "arguments"
  | "counterarguments"
  | "precedent"
  | "risk"
  | "deadlines"
  | "strategy"
  | "settlement"
  | "draft"
  | "quality"
  | "final"
  | "redact"
  | "bates"
  | "simulation";

export type LegalCommandReadiness = "documents" | "analysis" | "draft";

export interface LegalCommand {
  id: LegalCommandId;
  trigger: string;
  aliases: string[];
  label: string;
  description: string;
  requiredReadiness: LegalCommandReadiness;
}

export interface LegalCommandResolution {
  command?: LegalCommand;
  normalizedInput: string;
  isCommand: boolean;
}

export interface LegalCommandGate {
  allowed: boolean;
  severity: CaseReadinessSeverity;
  reason: string;
}

export const LEGAL_COMMANDS: LegalCommand[] = [
  {
    id: "chronology",
    trigger: "'kronologi",
    aliases: ["'tidslinje"],
    label: "Bygg kronologi",
    description: "Lager en kildebasert tidslinje fra dokumentgrunnlaget.",
    requiredReadiness: "analysis"
  },
  {
    id: "crosslink",
    trigger: "'krysskobling",
    aliases: ["'koblinger", "'mønstre", "'monster"],
    label: "Finn krysskoblinger",
    description: "Ser etter koblinger mellom aktører, transaksjoner og dokumenter.",
    requiredReadiness: "analysis"
  },
  {
    id: "evidence",
    trigger: "'bevis",
    aliases: ["'bevismatrise"],
    label: "Bygg bevismatrise",
    description: "Kobler påstander til støttende og svekkende kilder.",
    requiredReadiness: "analysis"
  },
  {
    id: "arguments",
    trigger: "'anforsler",
    aliases: ["'anførsler"],
    label: "Lag anførselsgrunnlag",
    description: "Starter et kontrollert anførselsgrunnlag fra kildene.",
    requiredReadiness: "analysis"
  },
  {
    id: "counterarguments",
    trigger: "'motargumenter",
    aliases: ["'motpart", "'svakheter"],
    label: "Finn motargumenter",
    description: "Finner mulige svakheter, motstrid og motpartens beste punkter.",
    requiredReadiness: "analysis"
  },
  {
    id: "precedent",
    trigger: "'presedens",
    aliases: ["'rettskilder", "'lovdata"],
    label: "Presedensgrunnlag",
    description: "Markerer rettskildebehov uten å hente eksterne rettskilder automatisk.",
    requiredReadiness: "analysis"
  },
  {
    id: "risk",
    trigger: "'risiko",
    aliases: ["'risikovurdering"],
    label: "Vurder risiko",
    description: "Lager kildebaserte risikopunkter og anbefalte kontroller.",
    requiredReadiness: "analysis"
  },
  {
    id: "deadlines",
    trigger: "'frister",
    aliases: ["'frist"],
    label: "Finn frister",
    description: "Leter etter datoer og fristpunkter i kildene.",
    requiredReadiness: "analysis"
  },
  {
    id: "strategy",
    trigger: "'strategi",
    aliases: ["'sporvalg"],
    label: "Vurder strategi",
    description: "Samler hovedspor, risiko og manglende informasjon.",
    requiredReadiness: "analysis"
  },
  {
    id: "settlement",
    trigger: "'forlik",
    aliases: ["'forliksspor"],
    label: "Forliksspor",
    description: "Forbereder temaer som kan testes i forlikssimulering.",
    requiredReadiness: "analysis"
  },
  {
    id: "draft",
    trigger: "'utkast",
    aliases: ["'draft"],
    label: "Lag kontrollert utkast",
    description: "Åpner utkastarbeid bare når saken er klar for utkastkontroll.",
    requiredReadiness: "draft"
  },
  {
    id: "quality",
    trigger: "'kvalitet",
    aliases: ["'kontroll"],
    label: "Kvalitetskontroll",
    description: "Åpner kontrollgrunnlag og readiness-verdict.",
    requiredReadiness: "documents"
  },
  {
    id: "final",
    trigger: "'endelig",
    aliases: ["'sluttkontroll"],
    label: "Endelig kontroll",
    description: "Blokkerer endelig bruk uten manuell juridisk godkjenning.",
    requiredReadiness: "draft"
  },
  {
    id: "redact",
    trigger: "'masker",
    aliases: ["'sladd", "'rediger"],
    label: "Maskering",
    description: "Åpner eksport/kontroll for manuell maskering. Automatisk maskering er ikke aktivert.",
    requiredReadiness: "draft"
  },
  {
    id: "bates",
    trigger: "'bates",
    aliases: ["'bilag"],
    label: "Bates/bilag",
    description: "Viser dokumentlisten og bilagsmetadata.",
    requiredReadiness: "documents"
  },
  {
    id: "simulation",
    trigger: "'rettssimulering",
    aliases: ["'dommer", "'kryssforhor", "'kryssforhør", "'prosedyre", "'dom"],
    label: "Rettssimulering",
    description: "Åpner separat treningsworkspace med readiness-gating.",
    requiredReadiness: "analysis"
  }
];

export function resolveLegalCommand(input: string): LegalCommandResolution {
  const normalizedInput = input.trim().toLowerCase();
  if (!normalizedInput.startsWith("'")) {
    return { normalizedInput, isCommand: false };
  }

  const command = LEGAL_COMMANDS.find((item) =>
    [item.trigger, ...item.aliases].some((alias) => normalizedInput === alias || normalizedInput.startsWith(`${alias} `))
  );

  return {
    command,
    normalizedInput,
    isCommand: true
  };
}

export function gateLegalCommand(
  command: LegalCommand,
  readinessVerdict: CaseReadinessVerdict,
  sourceCoveragePercent: number
): LegalCommandGate {
  if (command.requiredReadiness === "documents") {
    return {
      allowed: sourceCoveragePercent > 0 || readinessVerdict !== "not_ready",
      severity: readinessVerdict === "not_ready" ? "warning" : "success",
      reason:
        sourceCoveragePercent > 0 || readinessVerdict !== "not_ready"
          ? "Kommandoen kan brukes til kontroll av dokumentgrunnlaget."
          : "Importer dokumenter før kommandoen brukes."
    };
  }

  if (command.requiredReadiness === "analysis") {
    const allowed = readinessVerdict === "ready_for_preliminary_analysis" || readinessVerdict === "ready_for_draft_control";
    return {
      allowed,
      severity: allowed ? "success" : "critical",
      reason: allowed
        ? "Kommandoen kan brukes til foreløpig, kildebasert arbeid."
        : "Kommandoen er låst til dokumentgrunnlaget er klart for foreløpig analyse."
    };
  }

  const allowed = readinessVerdict === "ready_for_draft_control";
  return {
    allowed,
    severity: allowed ? "success" : "critical",
    reason: allowed
      ? "Kommandoen kan brukes til kontrollert utkastarbeid."
      : "Kommandoen er låst til saken er klar for utkastkontroll."
  };
}
