import type { SuggestedAction } from "../types/chat";

const ordinalMap: Record<string, number> = {
  "første": 1,
  "andre": 2,
  "tredje": 3,
  "fjerde": 4
};

export function resolveSuggestedAction(input: string, actions: SuggestedAction[]) {
  const normalized = input.trim().toLowerCase();
  const directNumber = normalized.match(/\b([1-4])\b/)?.[1];
  const ordinal = Object.entries(ordinalMap).find(([word]) => normalized.includes(word))?.[1];
  const index = directNumber ? Number(directNumber) : ordinal;
  if (!index) {
    return undefined;
  }
  return actions.find((action) => action.index === index);
}

