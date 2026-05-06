# AI_EVAL_PLAN

## Eval purpose
Prevent the AI feature from feeling impressive but unreliable. The goal is useful, cautious, traceable assistance.

## Eval set structure
Create fixtures:
- cases.json
- notes.json
- tasks.json
- activity_events.json
- expected_outputs.json

## Golden cases
At least 10 golden cases should have manually written expected traits:
- Facts the model must include.
- Details the model must not invent.
- Risks it should flag.
- Questions it should ask.
- Bad recommendations it must avoid.

## Automated checks
Use deterministic checks where possible:
- Output parses as JSON.
- Required fields exist.
- Summary length within bounds.
- No forbidden phrases.
- No cross-workspace references.
- Draft status is used.

## Human review checks
Human reviewer scores:
- Factual accuracy.
- Practical usefulness.
- Appropriate caution.
- Readability.
- Risk recognition.

## Regression process
Run evals:
- Before changing prompt.
- Before changing model.
- Before beta release.
- Before production launch.

## Minimum launch gate
No launch if:
- AI invents critical facts in golden cases.
- AI suggests unauthorized data exposure.
- AI output can bypass review state.
- AI failure corrupts existing approved summary.
