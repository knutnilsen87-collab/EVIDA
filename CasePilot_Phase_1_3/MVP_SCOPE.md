# MVP_SCOPE

## MVP goal
Build a usable case workspace where a small team can create cases, track status, collaborate, upload/reference files, and generate AI-assisted summaries and next-action suggestions.

## Must-have capabilities
- User authentication.
- Workspace/team model.
- Case list with status, owner, priority/risk, last updated, and next action.
- Create/edit/archive case.
- Case detail view with overview, timeline/activity, notes, tasks, files, and AI summary.
- Manual notes and task management.
- Basic file attachment metadata.
- AI-assisted case summary.
- AI-assisted next-action suggestions.
- Audit trail for important events.
- Role-based permissions for at least admin, manager, owner, collaborator.
- Basic search/filtering.

## Should-have
- Case templates.
- Tags/categories.
- Due dates and reminders.
- Export case summary to Markdown/PDF.
- Basic dashboard: open cases, overdue tasks, high-risk cases.
- Human approval marker for AI suggestions.

## Explicitly deferred
- Billing/subscriptions.
- Complex workflow automation.
- External email/calendar sync.
- Full document parsing/RAG over large file sets.
- Advanced analytics.
- Mobile app.
- Marketplace/integrations.

## Nice-to-have later
- Email intake.
- Client portal.
- Custom fields per workspace.
- Automations/triggers.
- Multi-language UI.
- Domain-specific packs for legal, compliance, support, consulting.

## What must not be built in v1
- Autonomous decision-making.
- Overly broad CRM features.
- Custom workflow builder.
- Complex enterprise SSO.
- AI actions that modify data without explicit confirmation.

## MVP success criteria
- A pilot team can manage 20-50 real cases without using spreadsheets as the primary tracker.
- AI summaries are useful enough that users choose to read them before asking colleagues for status.
- Managers can understand case portfolio health in under 5 minutes.
- The system has no known critical security, data-loss, or permission bugs.

## MVP cut line
If a feature does not help create, understand, progress, or safely manage a case, it is out of MVP.
