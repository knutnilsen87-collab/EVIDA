# Saksrom Adaptive Collaboration Spec

Status: implemented locally in `codex-adaptive-saksrom-litigation-v3`, not yet merged to `main`.

## Product Rule

Saksrom must behave like an adaptive legal collaboration workspace, not a static document chatbot.

Users can switch freely between:

- free natural chat
- suggested action buttons
- numeric follow-ups
- text commands

All interaction types stay in the same conversation timeline.

## Implemented Contract

- `SuggestedAction` is structured data with `id`, `index`, `label`, `intent`, `queryTemplate`, `requiredReadiness`, and `createdFromTurnId`.
- Numeric replies resolve against the latest assistant answer with suggestions.
- Supported numeric forms include `1`, `2`, `ta 3`, `punkt 2`, `den første`, and `gå videre med 4`.
- Suggested action clicks appear as normal user messages.
- Case-local memory stores previous answer, active mode, selected action, retrieval snapshot, sources used, and suggested actions.
- Workstyle preferences are stored locally.
- Assistant answers use visible work states and progressive reveal.
- The first Saksrom card shows case-level understanding before technical metadata.
- Saksrom may suggest `Test i Rettssimulering`, which routes to the separate Rettssimulering workspace with context from the current answer.

## Boundary

Rettssimulering is not a default Saksrom chat mode. It lives in its own sidebar workspace to reduce cognitive load and overtrust risk.

## UI Copy

Input placeholder:

```text
Spør fritt, velg et spor, eller skriv 1-4
```

After answers:

```text
Mulige neste spor å undersøke videre
Du kan også spørre fritt.
```

## Privacy Rule

Workstyle adaptation can learn local preferences only. Case-specific facts, client information, document content and legal conclusions must not be reused across cases by default.
