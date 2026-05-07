import type { CollaborationMode, SuggestedAction } from "./suggestedActions";

export interface RetrievalSnapshot {
  sourceIds: string[];
  sourceCoveragePercent: number;
  pendingTextRecognitionPages: number;
  sourceIndexVersion: string;
}

export interface CaseConversationMemory {
  caseId: string;
  previousAssistantAnswer?: string;
  suggestedActions: SuggestedAction[];
  selectedAction?: SuggestedAction;
  retrievalSnapshot?: RetrievalSnapshot;
  activeCollaborationMode: CollaborationMode;
  sourcesUsed: string[];
  updatedAt: string;
}

type ConversationMemoryStorage = Pick<Storage, "getItem" | "setItem">;
type CaseConversationMemoryStore = Record<string, CaseConversationMemory>;

export const CASE_CONVERSATION_MEMORY_KEY = "evida-case-conversation-memory-v1";

export const COLLABORATION_MODE_LABELS: Record<CollaborationMode, string> = {
  free_question: "Fritt spørsmål",
  find_main_tracks: "Finn hovedspor",
  build_chronology: "Bygg kronologi",
  find_contradictions: "Finn motstrid",
  find_patterns: "Finn mønstre og koblinger",
  rank_documents: "Ranger viktige dokumenter",
  identify_missing_information: "Finn manglende informasjon",
  prepare_controlled_draft_basis: "Forbered kontrollert utkastgrunnlag"
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readStore(storage: ConversationMemoryStorage): CaseConversationMemoryStore {
  const raw = storage.getItem(CASE_CONVERSATION_MEMORY_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    return isRecord(parsed) ? (parsed as CaseConversationMemoryStore) : {};
  } catch {
    return {};
  }
}

export function createEmptyCaseConversationMemory(caseId: string): CaseConversationMemory {
  return {
    caseId,
    suggestedActions: [],
    activeCollaborationMode: "free_question",
    sourcesUsed: [],
    updatedAt: new Date().toISOString()
  };
}

export function readCaseConversationMemory(
  storage: Pick<ConversationMemoryStorage, "getItem">,
  caseId: string
): CaseConversationMemory {
  const raw = storage.getItem(CASE_CONVERSATION_MEMORY_KEY);
  if (!raw) {
    return createEmptyCaseConversationMemory(caseId);
  }

  try {
    const parsed = JSON.parse(raw);
    if (!isRecord(parsed) || !isRecord(parsed[caseId])) {
      return createEmptyCaseConversationMemory(caseId);
    }

    return {
      ...createEmptyCaseConversationMemory(caseId),
      ...(parsed[caseId] as Partial<CaseConversationMemory>),
      caseId
    };
  } catch {
    return createEmptyCaseConversationMemory(caseId);
  }
}

export function writeCaseConversationMemory(
  storage: ConversationMemoryStorage,
  memory: CaseConversationMemory
): CaseConversationMemory {
  const store = readStore(storage);
  const normalized: CaseConversationMemory = {
    ...createEmptyCaseConversationMemory(memory.caseId),
    ...memory,
    suggestedActions: memory.suggestedActions ?? [],
    sourcesUsed: memory.sourcesUsed ?? [],
    updatedAt: memory.updatedAt || new Date().toISOString()
  };

  store[memory.caseId] = normalized;
  storage.setItem(CASE_CONVERSATION_MEMORY_KEY, JSON.stringify(store));
  return normalized;
}

export function updateCaseConversationMemory(
  storage: ConversationMemoryStorage,
  caseId: string,
  patch: Partial<Omit<CaseConversationMemory, "caseId">>
): CaseConversationMemory {
  const current = readCaseConversationMemory(storage, caseId);
  return writeCaseConversationMemory(storage, {
    ...current,
    ...patch,
    caseId,
    suggestedActions: patch.suggestedActions ?? current.suggestedActions,
    sourcesUsed: patch.sourcesUsed ?? current.sourcesUsed,
    updatedAt: new Date().toISOString()
  });
}

export function inferCollaborationModeFromText(text: string): CollaborationMode {
  const normalized = text.trim().toLowerCase();
  if (!normalized) {
    return "free_question";
  }

  if (/(kronologi|tidslinje|dato|rekkefølge|rekkefolge)/u.test(normalized)) {
    return "build_chronology";
  }

  if (/(motstrid|selvmotsig|strider|avvik|forklaring.*dokumentasjon)/u.test(normalized)) {
    return "find_contradictions";
  }

  if (/(mønster|monster|kobling|krysskobling|transaksjon|forbindelse|går igjen|gar igjen|aktør|aktor)/u.test(normalized)) {
    return "find_patterns";
  }

  if (/(mangler|manglende|hull|uklart|ikke dokumentert|trenger vi)/u.test(normalized)) {
    return "identify_missing_information";
  }

  if (/(viktig|viktigste|prioriter|ranger|nøkkeldokument|nokkeldokument)/u.test(normalized)) {
    return "rank_documents";
  }

  if (/(utkast|anførsel|anforsel|prosedyre|brev|notat)/u.test(normalized)) {
    return "prepare_controlled_draft_basis";
  }

  if (/(hovedspor|spor|tema|kontroll over|hvem hadde)/u.test(normalized)) {
    return "find_main_tracks";
  }

  return "free_question";
}
