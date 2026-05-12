# INTEGRATIONS_AND_EXTERNAL_SYSTEMS

## External APIs
MVP must not require external APIs.

Future optional APIs:
- managed OCR provider, only with explicit user consent
- cloud backup/sync, only if product adds cloud mode
- external document repositories: SharePoint, Google Drive, Dropbox, S3-compatible storage

## Webhooks
None in local desktop MVP.

Future:
- local event hooks for automation
- enterprise integration callbacks

## Queues/jobs
Required local durable queue.

Job types:
- `discover_source`
- `create_file_record`
- `hash_file`
- `detect_file_type`
- `inspect_archive`
- `extract_archive`
- `extract_text`
- `render_preview`
- `detect_scanned_pages`
- `run_ocr`
- `chunk_document`
- `index_chunks`
- `verify_file`
- `verify_session`
- `generate_report`
- `cleanup_temp`

Job requirements:
- persisted status
- idempotency key
- retry count
- failure code
- input/output artifact refs
- cancellation check
- pause check
- timeout

## Storage systems
### Local database
SQLite WAL.

### Local artifact store
For:
- extracted text
- OCR text/blocks
- previews/thumbnails
- reports
- diagnostics
- temporary extraction artifacts

### Original files
Product decision required:
1. Reference originals in place.
2. Copy originals into controlled case workspace.
3. Hybrid: reference by default, controlled copy optional.

Recommended MVP:
- Do not mutate originals.
- Store source path and hash.
- If user chooses portable case workspace, copy originals into controlled raw area.

## Notification providers
In-app notifications only.

## Auth/identity providers
Local user identity in MVP.

Future:
- workspace identity
- OS account integration
- organization/team accounts if cloud/team product emerges

## Operational dependencies
- Local filesystem access.
- Sufficient disk space.
- Available CPU/RAM.
- OCR binary/model availability if bundled.
- Parser libraries packaged correctly.
- SQLite availability.
- Optional OS preview/rendering dependencies if used.

## Parser/OCR adapter boundaries
Use interfaces, not direct coupling.

### Parser adapter
```ts
interface DocumentParser {
  canHandle(input: FileTypeDetection): boolean;
  inspect(input: FileRef): Promise<DocumentInspection>;
  extract(input: FileRef, options: ExtractOptions): Promise<ExtractionResult>;
}
```

### OCR adapter
```ts
interface OcrEngine {
  supportedLanguages(): string[];
  runPage(input: PageImageRef, options: OcrOptions): Promise<OcrResult>;
}
```

### Malware scanner adapter
```ts
interface MalwareScanner {
  scan(input: FileRef): Promise<ScanDecision>;
}
```

MVP can implement `MalwareScanner` as `not_configured` with explicit status, unless product requires bundled scanner.
