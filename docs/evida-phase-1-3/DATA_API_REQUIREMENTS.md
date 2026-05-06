# DATA_API_REQUIREMENTS

## Core entities / data objects
- User
- Workspace
- Membership
- Role
- Case
- CaseStatus
- CaseTemplate
- Note
- Task
- FileAttachment
- ActivityEvent
- AiSummary
- AiSuggestion
- AuditLog

## Relationships
- Workspace has many users through memberships.
- Workspace has many cases.
- Case belongs to one workspace.
- Case has one owner and many collaborators.
- Case has many notes, tasks, files, activity events, AI summaries, and suggestions.
- CaseTemplate belongs to workspace.

## CRUD needs
- Users: invite, update role, deactivate.
- Cases: create, read, update, archive, restore.
- Notes/tasks/files: create, read, update, delete/archive.
- AI summaries: create draft, approve, reject, supersede.
- Templates: create, update, archive.

## API consumers
- Web frontend.
- Future automation/integration clients.
- Admin/export tooling.

## External APIs / integrations
MVP:
- Auth provider or built-in auth.
- AI provider.
- Object/file storage.

Later:
- Email.
- Calendar.
- CRM.
- Document extraction/OCR.
- Payment provider.

## Search/filtering/sorting
- Case search by title, ID, tags, related entity, notes.
- Filter by status, owner, priority, risk, due date, updated date.
- Sort by updated date, due date, risk, status, owner.

## Reporting/analytics
- Case counts by status.
- Overdue tasks.
- Average case age.
- High-risk cases.
- Owner workload.

## Privacy/sensitive data considerations
- Treat all case data as potentially sensitive.
- Store AI outputs separately from human-authored facts.
- Keep audit log for sensitive actions.
- Do not send unnecessary data to AI provider.
- Configurable retention/export later.

## Data retention / audit
- MVP should log create/update/archive/restore/export/role-change/AI-approval events.
- Hard deletion should be admin-only or deferred.
