import type { CaseReadinessSeverity, CaseReadinessVerdict } from "../readiness/caseReadiness";

export type LegalCommandId = "chronology" | "evidence" | "risk" | "quality";

export type LegalCommandReadiness = "has_sources" | "preliminary" | "draft";

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
    requiredReadiness: "has_sources"
  },
  {
    id: "evidence",
    trigger: "'bevis",
    aliases: ["'bevismatrise"],
    label: "Bygg bevismatrise",
    description: "Kobler påstander til støttende og svekkende kilder.",
    requiredReadiness: "has_sources"
  },
  {
    id: "risk",
    trigger: "'risiko",
    aliases: ["'risikovurdering"],
    label: "Vurder risiko",
    description: "Lager kildebaserte risikopunkter og anbefalte kontroller.",
    requiredReadiness: "preliminary"
  },
  {
    id: "quality",
    trigger: "'kvalitet",
    aliases: ["'kontroll"],
    label: "Kvalitetskontroll",
    description: "Åpner kontrollgrunnlag og readiness-verdict.",
    requiredReadiness: "draft"
  }
];

const BLOCKED_REASON =
  "Jeg kan ikke kjøre denne modusen ennå fordi dokumentgrunnlaget ikke er klart nok. Trygt neste steg er å vente til dokumentene er ferdig behandlet eller se behandlingsstatus.";

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
  if (command.requiredReadiness === "has_sources") {
    const allowed = sourceCoveragePercent >= 50;
    return {
      allowed,
      severity: allowed ? "success" : "critical",
      reason: allowed ? "Kommandoen kan brukes til foreløpig, kildebasert arbeid." : BLOCKED_REASON
    };
  }

  if (command.requiredReadiness === "preliminary") {
    const allowed =
      sourceCoveragePercent >= 80 &&
      (readinessVerdict === "ready_for_preliminary_analysis" || readinessVerdict === "ready_for_draft_control");
    return {
      allowed,
      severity: allowed ? "success" : "critical",
      reason: allowed ? "Kommandoen kan brukes til foreløpig, kildebasert risikoarbeid." : BLOCKED_REASON
    };
  }

  const allowed = sourceCoveragePercent >= 95 && readinessVerdict === "ready_for_draft_control";
  return {
    allowed,
    severity: allowed ? "success" : "critical",
    reason: allowed ? "Kommandoen kan brukes til kontrollert kvalitetssjekk." : BLOCKED_REASON
  };
}
