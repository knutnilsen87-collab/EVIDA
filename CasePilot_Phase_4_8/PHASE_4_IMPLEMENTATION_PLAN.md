# PHASE_4_IMPLEMENTATION_PLAN

## Objective
Turn CasePilot from product definition into buildable engineering work.

## Architecture baseline
- Next.js + TypeScript.
- PostgreSQL.
- Prisma or Drizzle ORM.
- Auth provider with app-owned workspace membership.
- Private object storage.
- AI provider abstraction.
- Modular monolith.

## Implementation slices
1. Project scaffold and developer tooling.
2. Auth and workspace membership.
3. Core data model and migrations.
4. Case list and case detail.
5. Notes, tasks, activity events.
6. File metadata and private upload flow.
7. AI summary draft generation.
8. AI review/approval/rejection.
9. Dashboard, search, and filters.
10. Audit logging, permissions, and production checks.

## MVP technical guardrails
- Every protected API path must check workspace membership server-side.
- AI output must be saved as draft until approved.
- All destructive actions should be archive/soft-delete first.
- Files must be private by default.
- Audit logs should be append-only.
- Database migrations must be reviewed before production deploy.

## Delivery milestones
Milestone 1: App skeleton
- Project boots locally.
- Auth shell exists.
- Database connection and migration tool work.

Milestone 2: Core workspace/case model
- User can enter workspace.
- User can create/list/update/archive cases.

Milestone 3: Case workbench
- Notes, tasks, files, and activity timeline exist.
- Case detail is useful without AI.

Milestone 4: AI review loop
- Summary draft generation works.
- User can approve/edit/reject AI output.
- Prompt/model metadata is stored.

Milestone 5: Pilot readiness
- Permissions, audit, tests, monitoring, and deployment are ready.

## Out of scope for this implementation phase
- Billing.
- External client portal.
- Email/calendar integration.
- Full document RAG.
- Mobile app.
- Custom workflow builder.
