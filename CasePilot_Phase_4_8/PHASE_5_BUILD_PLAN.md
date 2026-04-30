# PHASE_5_BUILD_PLAN

## Objective
Build the first usable MVP of CasePilot.

## Build principle
Ship vertical slices that can be verified end-to-end. Avoid building isolated backend or frontend layers that cannot be used.

## Sprint 1: Foundation
Deliverables:
- Next.js app scaffold.
- TypeScript, linting, formatting.
- Database connection.
- ORM configured.
- Initial schema migration.
- Environment validation.
- Basic app shell.

Definition of done:
- App starts locally.
- Database migration runs.
- CI can run lint/typecheck/test.

## Sprint 2: Auth and workspace
Deliverables:
- Sign in/sign out.
- Workspace creation.
- Membership table.
- Role model.
- Workspace switcher or default workspace resolver.
- Server-side auth helpers.

Definition of done:
- User can sign in and enter a workspace.
- Non-member cannot access workspace data.
- Admin/member roles are stored and checked.

## Sprint 3: Case core
Deliverables:
- Create case.
- Case list.
- Case detail.
- Edit case metadata.
- Archive/restore case.
- Owner assignment.

Definition of done:
- A workspace member can create and manage a case.
- Case list supports basic filters.
- Audit events are written for create/update/archive.

## Sprint 4: Case workbench
Deliverables:
- Notes.
- Tasks.
- Activity timeline.
- File metadata.
- Private upload/download flow.

Definition of done:
- Case detail contains enough functionality to manage a real case without AI.
- File access is private and permission checked.
- Timeline records important events.

## Sprint 5: AI summary review loop
Deliverables:
- AI provider abstraction.
- Prompt template v1.
- Generate summary draft.
- Store AI metadata.
- Approve/edit/reject summary.
- Show latest approved summary in case overview.

Definition of done:
- AI output cannot become official without human action.
- Failed AI calls are handled without corrupting case state.
- Prompt version/model/provider are stored.

## Sprint 6: Dashboard and reporting
Deliverables:
- Dashboard cards.
- High-risk cases.
- Overdue tasks.
- Owner workload.
- Recently inactive cases.

Definition of done:
- Manager can understand portfolio health quickly.
- Dashboard respects workspace permissions.

## Sprint 7: MVP QA and pilot readiness
Deliverables:
- Integration tests for core flows.
- E2E smoke path.
- Error tracking.
- Production config review.
- Seed/demo data.
- Pilot onboarding notes.

Definition of done:
- P0 test suite passes.
- Manual QA checklist passes.
- Product is deployable to a staging environment.

## MVP release candidate checklist
- Auth works.
- Workspace isolation works.
- Case CRUD works.
- Notes/tasks/files work.
- AI draft/review works.
- Audit logs exist.
- Error states are clear.
- No known P0/P1 bugs.

## Build risks to watch
- Spending too long on UI polish before core flows work.
- Adding billing too early.
- Adding document parsing/RAG before the basic case workspace is useful.
- Trusting client-side permissions.
- Letting AI mutate case state directly.
