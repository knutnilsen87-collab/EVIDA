import type { DocumentBasisRow } from "../documents/documentBasis";
import type { DocumentControlBulkPlan } from "./documentControl.types";

export function canBulkMarkControlled(row: DocumentBasisRow) {
  return row.canApprove && row.state !== "needs_user_action" && row.state !== "rejected";
}

export function deriveDocumentControlBulkPlan(selectedRows: DocumentBasisRow[]): DocumentControlBulkPlan {
  const eligibleForControlled = selectedRows.filter(canBulkMarkControlled);
  const ocrRows = selectedRows.filter((row) => row.pendingOcrPages > 0 || row.state === "needs_text_control");
  const excludeRows = selectedRows.filter((row) => row.canReject);
  const replaceRows = selectedRows.filter((row) => row.state === "needs_user_action");

  return {
    selectedRows,
    eligibleForControlled,
    ocrRows,
    excludeRows,
    replaceRows,
    actions: [
      {
        id: "mark_controlled",
        label: "Marker som kontrollert",
        description: "Lagrer kontrollbeslutning for valgte dokumenter som kan kontrolleres samlet.",
        enabled: eligibleForControlled.length > 0,
        requiresConfirmation: true
      },
      {
        id: "run_ocr",
        label: "Kjør OCR for valgte",
        description: "Legger dokumenter med manglende tekst i OCR-kø.",
        enabled: ocrRows.length > 0,
        requiresConfirmation: false
      },
      {
        id: "exclude",
        label: "Hold utenfor kildegrunnlaget",
        description: "Dokumentene brukes ikke som kildegrunnlag for Saksrom.",
        enabled: excludeRows.length > 0,
        requiresConfirmation: true
      },
      {
        id: "replace",
        label: "Erstatt fil",
        description: "Velg en lesbar kopi for første valgte dokument som krever erstatning.",
        enabled: replaceRows.length > 0,
        requiresConfirmation: false
      }
    ]
  };
}
