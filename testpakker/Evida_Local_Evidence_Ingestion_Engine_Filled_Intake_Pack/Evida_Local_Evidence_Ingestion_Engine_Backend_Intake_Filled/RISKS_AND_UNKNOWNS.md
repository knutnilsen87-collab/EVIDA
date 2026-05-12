# RISKS_AND_UNKNOWNS

## Product risks
### R1: User trusts AI before import is complete
Mitigation:
- persistent import readiness banner
- preliminary-answer label
- explicit warning before full analysis
- "Vent til importen er fullført" default CTA

### R2: User misunderstands manual review
Manual review may be interpreted as Evida has read the content.
Mitigation:
- label clearly: "Manuelt sett, ikke maskinlest"
- AI must not cite text from manually reviewed unreadable page unless transcribed
- report separates machine-readable and manually reviewed

### R3: Too much technical detail overwhelms user
Mitigation:
- plain-language reason first
- technical details collapsible
- review queue as actionable list

## Technical risks
### R4: OCR is slow
Mitigation:
- priority lanes
- page-level status
- background queue
- AI usable partial mode
- OCR only where needed

### R5: Large files cause memory pressure
Mitigation:
- streaming hash/extract
- worker limits
- file size policy
- backpressure
- timeout and retry

### R6: Parser instability
Mitigation:
- adapter boundary
- sandbox/worker isolation
- per-file failure isolation
- fallback parser later
- golden corrupt tests

### R7: Desktop packaging complexity
Mitigation:
- choose minimal reliable parser/OCR stack
- package smoke tests
- clear binary/model version logging

### R8: SQLite concurrency
Mitigation:
- WAL mode
- short transactions
- batch writes
- single writer queue if needed
- migration tests

## Design/UX risks
### R9: False 100 % progress
Mitigation:
- separate metrics: import, processing, verification, AI usable
- never use one progress bar as truth
- complete status gated by verification

### R10: Manual review queue becomes too large
Mitigation:
- group by reason/document
- severity/prioritization
- bulk mark blank/not relevant only with safeguards
- retry OCR batch action

## Delivery risks
### R11: Scope explosion
Mitigation:
- MVP cut line: no silent file loss + manual review + basic extraction/OCR
- defer advanced legal classification, Bates, semantic search

### R12: Too many file formats
Mitigation:
- required support list for MVP
- explicit unsupported status for deferred formats
- no silent fallback

## Dependency risks
### R13: OCR engine licensing/quality
Mitigation:
- evaluate local OCR options early
- adapter abstraction
- confidence thresholds
- review queue

### R14: PDF library limitations
Mitigation:
- adapter abstraction
- page-level verification
- corrupt/mixed PDF golden tests

## Legal/policy/privacy risks
### R15: Sensitive documents leaving machine
Mitigation:
- local-only default
- no cloud processing without explicit consent
- UI disclosure if cloud mode ever introduced

### R16: Logs accidentally contain sensitive text
Mitigation:
- content-free logs by default
- explicit diagnostics export modes

## Unknowns that must be resolved early
1. Evida desktop stack: Electron, Tauri, native, or other?
2. Will originals be copied into Evida workspace or referenced in place?
3. Must MVP include a bundled malware scanner or only an adapter?
4. Which OCR engine will be bundled first?
5. Which PDF parser/rendering library will be bundled first?
6. Is local DB encryption required for MVP?
7. Are EML/MSG required in first production release or can they be explicit unsupported/deferred?
8. Should manual review allow user transcription in v1 or only checkbox/status?
9. What hardware baseline should performance targets assume?

## Decisions still open
- Desktop runtime implementation details.
- OCR engine choice.
- Parser library choice.
- Controlled copy vs source path reference.
- Local encryption level.
- Exact UI visual design.
- Whether to support batch "mark reviewed" actions in MVP.
