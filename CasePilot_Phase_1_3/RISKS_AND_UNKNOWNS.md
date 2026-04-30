# RISKS_AND_UNKNOWNS

## Product risks
- CasePilot may be too broad unless the first market/niche is chosen.
- Users may already have entrenched tools.
- AI summaries must be trusted but not overtrusted.

## Technical risks
- Permission bugs can expose sensitive case data.
- File storage and AI data handling can become complex.
- Search over notes/files may need more architecture than basic SQL later.

## Design/UX risks
- Too many fields can make case creation feel heavy.
- Too little structure makes it no better than notes/spreadsheets.
- AI panel can distract from core workflow if not integrated carefully.

## Delivery risks
- Building CRM/project-management features by accident.
- Adding billing/integrations too early.
- Underestimating audit/permissions.

## Dependency risks
- AI provider cost and latency.
- Auth/provider lock-in.
- Managed database/storage costs.

## Legal/policy/privacy risks
- Sensitive personal or client data.
- AI provider data processing terms.
- Retention/export/deletion expectations.
- Industry-specific compliance if targeting legal/health/finance.

## Unknowns that must be resolved early
- First target niche.
- Must-have case fields.
- Whether external clients need access in v1.
- Data sensitivity level.
- Whether AI should analyze uploaded documents in MVP.
- Paid SaaS now or pilot-first.

## Decisions still open
- Auth provider.
- Hosting provider.
- AI provider/model.
- Billing timeline.
- Localization priority.
