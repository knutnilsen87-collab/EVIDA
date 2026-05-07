import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export type UnlistenFn = () => void;

export type PdfImportProgressEvent =
  | {
      type: "received";
      document_id: string;
      filename: string;
      file_size: number;
    }
  | {
      type: "probed";
      document_id: string;
      page_count: number;
      has_text_layer: boolean;
      needs_ocr: boolean;
      is_encrypted: boolean;
      is_corrupt: boolean;
      document_type: string;
      document_type_guess: string;
    }
  | {
      type: "page_progress";
      document_id: string;
      page_number: number;
      page_count: number;
      pages_with_text: number;
      word_count_estimate: number;
    }
  | {
      type: "text_extracted";
      document_id: string;
      status: string;
      page_count: number;
      pages_with_text: number;
      pages_failed: number;
      word_count_estimate: number;
      needs_ocr: boolean;
    }
  | {
      type: "search_indexed";
      document_id: string;
      chunk_count: number;
      word_count_estimate: number;
      search_ready: boolean;
      citation_ready: boolean;
    }
  | {
      type: "quality_report";
      document_id: string;
      overall_quality: "high" | "medium" | "low";
      page_count: number;
      pages_text_extracted: number;
      pages_ocr_required: number;
      pages_failed: number[];
      low_quality_pages: number[];
      citation_ready: boolean;
      search_ready: boolean;
      ai_ready: boolean;
      warnings: string[];
    }
  | {
      type: "document_ready";
      document_id: string;
      status: string;
      readiness: {
        imported: boolean;
        search_ready: boolean;
        citation_ready: boolean;
        ai_ready: boolean;
        needs_review: boolean;
      };
    }
  | {
      type: "failed";
      document_id?: string;
      error_code: string;
      message?: string;
    }
  | {
      type: "worker_error";
      message: string;
    }
  | {
      type: "worker_log";
      message: string;
    };

export type SearchResult = {
  document_id: string;
  filename: string;
  page_number: number;
  chunk_id: string;
  snippet: string;
};

export async function importSinglePdf(input: {
  pdfPath: string;
  caseId: string;
}): Promise<{ ok: boolean; message: string }> {
  return invoke("import_single_pdf", {
    request: {
      pdf_path: input.pdfPath,
      case_id: input.caseId,
    },
  });
}

export async function listenToPdfImportProgress(
  callback: (event: PdfImportProgressEvent) => void,
): Promise<UnlistenFn> {
  return listen<PdfImportProgressEvent>("pdf-import-progress", (event) => {
    callback(event.payload);
  });
}

export async function searchImportedPdf(input: {
  caseId: string;
  query: string;
  limit?: number;
}): Promise<{ results: SearchResult[] }> {
  return invoke("search_imported_pdf", {
    request: {
      case_id: input.caseId,
      query: input.query,
      limit: input.limit ?? 20,
    },
  });
}
