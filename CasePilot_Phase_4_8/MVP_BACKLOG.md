# MVP_BACKLOG

## P0: Must build before pilot

### Foundation
- Scaffold Next.js TypeScript app.
- Configure lint, format, typecheck.
- Configure PostgreSQL and ORM.
- Add migrations.
- Add environment validation.

### Auth and workspace
- Add sign in/sign out.
- Create workspace model.
- Add memberships and roles.
- Enforce server-side membership checks.

### Cases
- Create case.
- List cases.
- View case detail.
- Edit case metadata.
- Archive/restore case.
- Assign owner.
- Filter by status, owner, risk, priority.

### Case workbench
- Add notes.
- Edit/archive notes.
- Add tasks.
- Update task status.
- Assign task.
- Add due dates.
- Store file metadata.
- Upload/download private files.
- Activity timeline.

### AI
- Generate AI summary draft.
- Store prompt version/model/provider.
- Approve/edit/reject summary.
- Show latest approved summary separately from draft.
- Log AI failures cleanly.

### Security and audit
- Role checks.
- Case access checks.
- Audit sensitive actions.
- Private file URLs.
- Rate limit AI requests.

### QA
- Unit tests for permission helpers.
- Integration tests for case CRUD.
- Integration tests for AI summary review flow.
- Manual QA checklist.

## P1: Strongly preferred for beta
- Dashboard metrics.
- Basic reminders.
- Case templates.
- Export case summary to Markdown.
- Invite flow.
- Error tracking.
- Production monitoring.

## P2: Post-MVP
- Billing.
- Email intake.
- Calendar integration.
- Full document parsing/RAG.
- Client portal.
- Advanced analytics.
- Custom workflow builder.

## First 10 implementation tickets
1. Scaffold app and developer tooling.
2. Add database schema and initial migration.
3. Implement auth/session and workspace membership.
4. Implement role/permission helpers.
5. Build case list and create case flow.
6. Build case detail shell.
7. Add notes/tasks/activity.
8. Add private file metadata/upload flow.
9. Add AI summary draft/review flow.
10. Add tests, monitoring hooks, and pilot readiness fixes.
