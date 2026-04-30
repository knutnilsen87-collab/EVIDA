# PHASE_6_AI_EVALUATION_HARDENING

## Objective
Make CasePilot's AI layer useful, traceable, bounded, and safe enough for real pilot work.

## AI scope in MVP
Allowed:
- Draft case summary.
- Draft next-action suggestions.
- Identify missing information.
- Summarize recent activity.

Not allowed:
- Final decisions.
- Silent edits to case data.
- Sending messages externally.
- Changing status, owner, due date, or risk without user confirmation.
- Legal/medical/financial determinations unless specifically reviewed by qualified humans.

## Prompt versioning
Every AI request should store:
- prompt_version
- provider
- model
- requested_by_user_id
- case_id
- input_refs_json
- token/cost metadata if available
- latency
- output status

Prompt versions:
- case_summary_v1
- next_actions_v1
- missing_info_v1

## AI output structure
Use structured output where possible:

```json
{
  "summary": "Short factual summary.",
  "known_facts": ["Fact 1", "Fact 2"],
  "open_questions": ["Question 1"],
  "suggested_next_actions": ["Action 1"],
  "risk_flags": ["Risk 1"],
  "confidence_notes": "What the model is uncertain about."
}
```

## Human review states
- draft: created by AI, not approved.
- approved: reviewed by permitted human.
- edited: human changed AI output before approving.
- rejected: human decided not to use it.
- superseded: newer summary replaced it.
- failed: generation failed.

## Evaluation dataset
Create 20-30 representative fake/synthetic cases:
- Simple support case.
- Complex multi-step case.
- Case with missing information.
- High-risk case.
- Case with contradictory notes.
- Case with many tasks.
- Case with stale activity.
- Case with sensitive data placeholders.

Do not use real sensitive customer data in the eval dataset.

## Evaluation criteria
Score each AI output from 1-5:
- Factual grounding.
- Completeness.
- Usefulness.
- Clarity.
- Safety.
- Separation of fact vs suggestion.
- Handling of uncertainty.

Minimum pass target before beta:
- Average score >= 4.0.
- No critical hallucination in golden cases.
- No unauthorized action recommendations.

## Guardrails
- Limit input to relevant case context.
- Redact unnecessary sensitive data where possible.
- Keep generated output in draft state.
- Show source context references when feasible.
- Warn when case data is insufficient.
- Rate limit generation.
- Log failures.

## Failure handling
If AI fails:
- Preserve existing approved summary.
- Show retry option.
- Log provider/model/error category.
- Do not create misleading draft.

If AI output is low quality:
- User can reject with reason.
- Rejection reason feeds future prompt/eval improvement.

## Cost and latency controls
- Track latency per generation.
- Track estimated tokens/cost.
- Add per-workspace AI rate limits.
- Cache or reuse recent summaries when case has not changed.
- Run longer operations async if needed.

## Red-team checks
Test that the AI does not:
- Treat draft notes as verified facts without caution.
- Invent missing details.
- Recommend bypassing permissions.
- Reveal data from another workspace.
- Produce final legal/medical/financial advice as authoritative.

## Phase 6 exit criteria
- AI outputs are versioned and auditable.
- Human review is enforced.
- Eval dataset exists.
- Eval score meets beta threshold.
- AI failure states are safe.
- Cost/latency are visible to operators.
