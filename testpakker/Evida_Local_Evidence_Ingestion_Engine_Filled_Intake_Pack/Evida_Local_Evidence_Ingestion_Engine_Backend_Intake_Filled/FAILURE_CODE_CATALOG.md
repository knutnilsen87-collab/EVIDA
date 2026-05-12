# FAILURE_CODE_CATALOG

## Purpose
Failure codes must be stable, user-explainable and machine-actionable. Do not create ad-hoc error strings as canonical status.

## Failure code format
`CATEGORY_REASON_DETAIL`

Examples:
- `FILE_ZERO_BYTES`
- `FILE_LOCKED_BY_SYSTEM`
- `TYPE_UNSUPPORTED`
- `PDF_CORRUPT`
- `OCR_LOW_CONFIDENCE`
- `ARCHIVE_PATH_TRAVERSAL_BLOCKED`

## File access
### FILE_ZERO_BYTES
User message: "Filen er tom."  
Retryable: no.  
Review item: optional.

### FILE_NOT_FOUND
User message: "Filen ble ikke funnet. Den kan være flyttet eller slettet."  
Retryable: yes.

### FILE_LOCKED_BY_SYSTEM
User message: "Filen er låst av et annet program."  
Retryable: yes.

### FILE_PERMISSION_DENIED
User message: "Evida har ikke tilgang til filen."  
Retryable: yes after user action.

## Type detection
### TYPE_UNSUPPORTED
User message: "Filtypen støttes ikke i denne versjonen."  
Retryable: no unless support added.

### TYPE_MISMATCH
User message: "Filendelsen stemmer ikke med filinnholdet."  
Retryable: no; review recommended.

### TYPE_UNKNOWN
User message: "Evida klarte ikke å identifisere filtypen."  
Retryable: no; manual review.

## Security/archive
### ARCHIVE_PATH_TRAVERSAL_BLOCKED
User message: "Arkivet ble blokkert fordi det forsøker å pakke ut filer utenfor sikker mappe."  
Retryable: no.

### ARCHIVE_BOMB_RISK
User message: "Arkivet ble blokkert fordi det kan være for stort eller usikkert å pakke ut."  
Retryable: no/manual.

### ARCHIVE_PASSWORD_PROTECTED
User message: "Arkivet er passordbeskyttet."  
Retryable: yes after password support/user action.

### ARCHIVE_TOO_DEEP
User message: "Arkivet har for mange nivåer med undermapper/arkiver."  
Retryable: no unless policy changed.

## Document parsing
### PDF_CORRUPT
User message: "PDF-en ser ut til å være skadet."  
Retryable: maybe with fallback parser.

### PDF_PASSWORD_PROTECTED
User message: "PDF-en er passordbeskyttet."  
Retryable: yes after password.

### PDF_PAGE_COUNT_FAILED
User message: "Evida klarte ikke å telle sider i PDF-en."  
Retryable: yes/fallback.

### DOCX_CORRUPT
User message: "DOCX-filen ser ut til å være skadet."  
Retryable: maybe.

### XLSX_PARSE_FAILED
User message: "Regnearket kunne ikke leses."  
Retryable: maybe.

## OCR
### OCR_ENGINE_UNAVAILABLE
User message: "OCR-motoren er ikke tilgjengelig."  
Retryable: yes after configuration.

### OCR_PAGE_FAILED
User message: "Evida klarte ikke å lese denne siden automatisk."  
Retryable: yes.

### OCR_LOW_CONFIDENCE
User message: "Evida er usikker på teksten på denne siden."  
Retryable: yes/review.

### OCR_TIMEOUT
User message: "OCR tok for lang tid på denne siden."  
Retryable: yes.

## Indexing/provenance
### CHUNK_SOURCE_REF_MISSING
User message: "Tekstutdraget mangler kildehenvisning og kan ikke brukes av AI."  
Retryable: developer/system fix.

### INDEX_WRITE_FAILED
User message: "Evida klarte ikke å oppdatere søkeindeksen."  
Retryable: yes.

## System/resource
### DISK_SPACE_LOW
User message: "Det er ikke nok ledig diskplass til å fullføre importen."  
Retryable: yes after user action.

### DB_WRITE_FAILED
User message: "Evida klarte ikke å lagre importstatus."  
Retryable: yes, critical.

### WORKER_CRASHED
User message: "En bakgrunnsprosess stoppet uventet. Evida forsøker å gjenoppta."  
Retryable: yes.

### JOB_TIMEOUT
User message: "Behandlingen tok for lang tid."  
Retryable: yes with adjusted policy.

## Manual review resolution codes
- `MANUAL_SEEN`
- `MANUAL_RELEVANT`
- `MANUAL_NOT_RELEVANT`
- `MANUAL_BLANK`
- `MANUAL_UNREADABLE_BUT_SEEN`
- `MANUAL_EXCLUDED`
- `MANUAL_RETRY_REQUESTED`
- `MANUAL_REQUIRES_FOLLOWUP`
