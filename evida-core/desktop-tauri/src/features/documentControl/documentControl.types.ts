import type { DocumentBasisRow } from "../documents/documentBasis";

export type DocumentControlBulkActionId = "approve_as_source" | "mark_not_citable" | "run_ocr" | "exclude" | "replace";

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
  eligibleAsSource: DocumentBasisRow[];
  eligibleNotCitable: DocumentBasisRow[];
  ocrRows: DocumentBasisRow[];
  excludeRows: DocumentBasisRow[];
  replaceRows: DocumentBasisRow[];
  actions: DocumentControlBulkAction[];
}
