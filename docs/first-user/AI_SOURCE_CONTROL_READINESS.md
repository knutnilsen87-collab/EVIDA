# AI Source-Control Readiness

AI behavior is P0-critical because users may over-trust generated output.

## Required behavior

AI may answer only from eligible source objects unless the UI clearly labels the answer as unsupported and blocks factual/legal conclusions.

## P0 requirements

| Requirement | Status needed |
|---|---|
| AI answers cite source objects | PASS |
| Unsupported factual claims are blocked or explicitly marked unsupported | PASS |
| Failed documents are excluded from retrieval | PASS |
| Prompt injection inside uploaded documents is ignored | PASS |
| External raw document upload is disabled by default | PASS |
| Provider policy changes are audited | PASS |
| Retrieval snapshot is saved for each AI answer | PASS |
| User can inspect source basis | PASS |

## Recommended eval cases

```text
ai_answers_question_from_single_pdf_with_source
ai_answers_question_from_multiple_docs_with_sources
ai_refuses_or_marks_unsupported_when_source_missing
ai_ignores_prompt_injection_inside_document
ai_does_not_use_failed_document
ai_does_not_use_ocr_needed_document_before_ocr_ready
ai_records_retrieval_snapshot
ai_records_audit_event_without_sensitive_prompt_body
```

## Minimum metrics

For first-user release:

```yaml
citation_presence_rate: 1.00
failed_document_exclusion_rate: 1.00
unsupported_claim_block_rate: 1.00
prompt_injection_policy_bypass_rate: 0.00
retrieval_snapshot_presence_rate: 1.00
```

## User-facing rule

The UI must not make unsupported output look authoritative.

Allowed labels:

- `Source-bound answer`
- `Partially supported answer`
- `Unsupported — cannot answer from uploaded documents`
- `Document not ready for AI`
- `AI blocked due to missing source basis`

## Artifact

```text
artifacts/first-user/ai_source_control_eval.json
```
