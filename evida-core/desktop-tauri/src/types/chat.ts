export type SuggestedActionIntent =
  | "explain_case"
  | "build_timeline"
  | "find_evidence"
  | "find_contradictions"
  | "find_patterns"
  | "identify_missing_information"
  | "rank_documents"
  | "run_quality_check";

export type SuggestedAction = {
  id: string;
  index: number;
  label: string;
  intent: SuggestedActionIntent;
  queryTemplate: string;
  requiredReadiness: "has_sources" | "preliminary_ready" | "draft_ready";
  createdFromTurnId: string;
};

export type ChatTurn = {
  id: string;
  role: "user" | "assistant";
  text: string;
  visibleText?: string;
  isStreaming?: boolean;
  createdAt: string;
  suggestedActions?: SuggestedAction[];
};

