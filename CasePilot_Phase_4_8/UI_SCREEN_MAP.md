# UI_SCREEN_MAP

## App shell
- Left sidebar: Dashboard, Cases, Templates, Team, Settings.
- Top bar: workspace switcher, search, user menu.
- Main content: current screen.

## Public/auth screens
- Sign in.
- Sign up.
- Accept invitation.
- Forgot/reset password if auth provider requires local UI.

## Onboarding screens
- Create workspace.
- Invite team.
- Choose starter case template.
- Create first case.

## Dashboard
Purpose: show portfolio health.

Components:
- Open cases count.
- High-risk cases.
- Overdue tasks.
- Recently inactive cases.
- Cases by status.
- Owner workload.

## Cases list
Purpose: primary operational queue.

Components:
- Search.
- Filters: status, owner, risk, priority, due date.
- Sort controls.
- Case table.
- Create case button.
- Saved view later.

Table columns:
- Case number.
- Title.
- Status.
- Owner.
- Risk.
- Priority.
- Next action.
- Due date.
- Updated.

## Create/edit case
Fields:
- Title.
- Description.
- Owner.
- Status.
- Priority.
- Risk level.
- Due date.
- Tags later.

## Case detail
Top area:
- Title.
- Status.
- Owner.
- Risk.
- Priority.
- Due date.
- Latest approved summary.
- Next action.

Tabs/sections:
- Overview.
- Tasks.
- Notes.
- Files.
- Activity.
- AI review.

## AI review panel
Purpose: keep AI draft visibly separate from verified case state.

States:
- No summary yet.
- Generating.
- Draft ready.
- Approved.
- Rejected.
- Failed.

Actions:
- Generate draft.
- Edit draft.
- Approve.
- Reject.
- Regenerate.

## Team/admin
Screens:
- Members.
- Invite user.
- Change role.
- Remove/deactivate user.
- Workspace settings.
- Case templates.
- Audit logs.

## Empty states
- No cases: prompt to create first case.
- No notes/tasks/files: compact creation controls.
- No AI summary: explain that AI summaries are drafts and require review.

## Responsive behavior
Desktop-first:
- Case detail can use two-column layout with AI/recent activity side panel.

Mobile:
- Collapse sidebar.
- Case list becomes compact cards.
- Case detail sections become stacked tabs.
