# Production Readiness Checklist

## Formål

Denne sjekklisten skal gate pilot og produksjon.

Pilot kan ha begrensede features, men ikke lavere tillitsnivå.

## Build gates

```text
[ ] npm.cmd run build passes.
[ ] Tauri app starts successfully.
[ ] No blocking TypeScript errors.
[ ] No blocking Rust build errors.
[ ] No known crash in normal case workflow.
```

## AI answer gates

```text
[ ] Answer Quality Gate enabled.
[ ] Raw AI output cannot render directly.
[ ] Source metadata blocked from main answer.
[ ] Structured JSON schema enforced.
[ ] Retry on validation failure works.
[ ] Safe fallback works.
[ ] Source IDs are validated.
[ ] Old stored AI messages render safely.
[ ] Golden tests pass.
```

## Source/document gates

```text
[ ] Source coverage is visible.
[ ] Pending/OCR pages are visible.
[ ] Evida does not claim 100% if pages are missing.
[ ] User can see whether documents are still being processed.
[ ] Source objects can be opened/inspected.
[ ] Raw source data is not mutated by AI excerpt cleaning.
```

## Security gates

```text
[ ] Security tab is status-first.
[ ] External AI is off by default.
[ ] Full document sending is disabled by default.
[ ] External AI requires confirmation if enabled.
[ ] Logs do not include full document text.
[ ] Logs do not include sensitive chat content by default.
[ ] Export without control is disabled by default.
[ ] Database security status is visible.
```

## Desktop workspace gates

```text
[ ] User can create new case.
[ ] User can switch cases.
[ ] User can open new case in new window.
[ ] User can open existing case in new window.
[ ] Same case focuses existing window instead of duplicate write window.
[ ] Each window has isolated case context.
[ ] Window title shows active case.
[ ] Header shows active case and readiness.
```

## Readability gates

```text
[ ] Saksrom body text is comfortable to read.
[ ] Reading column is limited.
[ ] Important points are scannable.
[ ] Uncertainty is visually clear.
[ ] Source section is separate.
[ ] Sticky input still works.
```

## Hard blockers

Do not release if:

```text
[BLOCKER] AI answer can render without validation.
[BLOCKER] AI answer repeats document metadata in main answer.
[BLOCKER] AI answer invents certainty without sources.
[BLOCKER] Process/status question is answered as case-content.
[BLOCKER] Source IDs are invalid or hallucinated.
[BLOCKER] Fallback exposes raw AI/provider text.
[BLOCKER] Golden tests fail.
[BLOCKER] External AI sends full documents by default.
[BLOCKER] Document coverage is misleading.
[BLOCKER] One window can write to wrong case.
```

## Final sign-off

```text
[ ] CTO/product owner reviewed.
[ ] Manual demo path tested.
[ ] Golden tests passed.
[ ] Build passed.
[ ] Known blockers closed or explicitly accepted.
```
