import { resolveSuggestedAction } from "./intentParser";
import type { SuggestedAction } from "../types/chat";

const actions: SuggestedAction[] = [1, 2, 3, 4].map((index) => ({
  id: `action-${index}`,
  index,
  label: `Spor ${index}`,
  intent: "explain_case",
  queryTemplate: `Spor ${index}`,
  requiredReadiness: "has_sources",
  createdFromTurnId: "test-turn"
}));

export const intentParserTestCases = [
  ["1", 1],
  ["ta 2", 2],
  ["den første", 1],
  ["punkt 3", 3],
  ["den fjerde", 4]
] as const;

export function runIntentParserTestCase(input: string) {
  return resolveSuggestedAction(input, actions);
}

