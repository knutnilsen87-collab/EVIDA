export type CollaborationMode =
  | "free_question"
  | "find_main_tracks"
  | "build_chronology"
  | "find_contradictions"
  | "find_patterns"
  | "rank_documents"
  | "identify_missing_information"
  | "prepare_controlled_draft_basis";

export interface SuggestedAction {
  id: string;
  index: number;
  label: string;
  intent: CollaborationMode;
  queryTemplate: string;
  requiredReadiness: "ready_for_preliminary_analysis" | "ready_for_draft_control";
  createdFromTurnId: string;
}

const ORDINAL_INDEX: Record<string, number> = {
  "første": 1,
  "forste": 1,
  "andre": 2,
  "tredje": 3,
  "fjerde": 4
};

export function createDefaultSuggestedActions(createdFromTurnId: string): SuggestedAction[] {
  const actions = [
    {
      label: "Hvem hadde faktisk kontroll over selskapene?",
      intent: "find_main_tracks" as const,
      queryTemplate: "Undersøk hvem som faktisk hadde kontroll over selskapene, og vis kilder for hvert funn."
    },
    {
      label: "Hvilke transaksjoner går igjen i flere dokumenter?",
      intent: "find_patterns" as const,
      queryTemplate: "Finn transaksjoner, beløp eller aktører som går igjen i flere dokumenter, og vis mønstre med kilder."
    },
    {
      label: "Stemmer tidslinjen med forklaringene?",
      intent: "build_chronology" as const,
      queryTemplate: "Bygg en kort kronologi og vurder om tidslinjen stemmer med forklaringene. Vis usikkerhet og kilder."
    },
    {
      label: "Finnes det motstrid mellom forklaring og dokumentasjon?",
      intent: "find_contradictions" as const,
      queryTemplate: "Se etter motstrid mellom forklaringer og dokumentasjon. Skill direkte motstrid fra usikkerhet."
    }
  ];

  return actions.map((action, offset) => ({
    id: `${createdFromTurnId}-suggestion-${offset + 1}`,
    index: offset + 1,
    requiredReadiness: "ready_for_preliminary_analysis",
    createdFromTurnId,
    ...action
  }));
}

export function resolveSuggestedActionReply(
  input: string,
  actions: SuggestedAction[]
): SuggestedAction | undefined {
  const normalized = input.trim().toLowerCase();
  if (!normalized || actions.length === 0) {
    return undefined;
  }

  const ordinal = Object.entries(ORDINAL_INDEX).find(([word]) => normalized.includes(word));
  const requestedIndex =
    ordinal?.[1] ??
    Number(
      normalized.match(/(?:^|\b)(?:nr\.?|nummer|punkt|ta|velg|se på punkt|gå videre med)?\s*([1-9])(?:\b|$)/)?.[1] ??
        0
    );

  if (!requestedIndex) {
    return undefined;
  }

  return actions.find((action) => action.index === requestedIndex);
}
