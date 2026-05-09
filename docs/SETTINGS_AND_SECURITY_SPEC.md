# Settings And Security Spec

Status: implemented baseline for Evida desktop evaluation.

## Product Rule

Settings must make Evida's safety posture visible before exposing controls. External AI and full-document sending are off by default.

## Required Sections

- Generelt
- Saksrom
- Dokumenter
- Sikkerhet
- Lagring
- AI-provider
- Tilgjengelighet
- Tastatursnarveier
- Om Evida

## Security Defaults

- External AI disabled by default.
- Full document sending disabled by default.
- Confirmation required before external sending.
- Logging should avoid document text, chat content, sensitive paths and sensitive field values.
- Export without control disabled by default.

## Saksrom Settings

Saksrom settings include answer length, answer structure, work states, progressive reveal, follow-scroll, next-step suggestions and 1–4 replies.

## Accessibility Settings

Accessibility controls include text size, high contrast, reduced motion, typewriter behavior, auto-follow behavior and live announcements for import/answer/summary status.

## Acceptance Criteria

- Settings are reachable from menu and `Ctrl+,`.
- Security status is shown before controls.
- Storage settings show the local storage path.
- Keyboard shortcuts listed in settings map to implemented shortcuts or are visibly safe placeholders.
- Workstyle adaptation stays local and does not learn case content across cases by default.
