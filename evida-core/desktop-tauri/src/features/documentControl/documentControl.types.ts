import type { DocumentBasisRow } from "../documents/documentBasis";

export type DocumentControlBulkActionId = "mark_controlled" | "run_ocr" | "exclude" | "replace";

export interface DocumentControlBulkAction {
  id: DocumentControlBulkActionId;
  label: string;
  description: string;
  enabled: boolean;
  requiresConfirmation: boolean;
}

export interface DocumentControlBulkPlan {
  selectedRows: DocumentBasisRow[];
  eligibleForControlled: DocumentBasisRow[];
  ocrRows: DocumentBasisRow[];
  excludeRows: DocumentBasisRow[];
  replaceRows: DocumentBasisRow[];
  actions: DocumentControlBulkAction[];
}
