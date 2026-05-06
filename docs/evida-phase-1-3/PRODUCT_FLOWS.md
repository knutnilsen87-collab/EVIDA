# PRODUCT_FLOWS

## Signup/login flow
1. User creates account or accepts workspace invitation.
2. User verifies email.
3. User joins or creates workspace.
4. User lands on case dashboard.

## Onboarding flow
1. Admin creates workspace.
2. Admin selects default case template.
3. Admin invites team members.
4. First case is created from template or blank.
5. Product prompts user to define owner, status, risk, and next action.

## Core user journey 1: Create and progress a case
1. User creates a case.
2. User adds summary, parties/entities, status, priority/risk, and owner.
3. User adds notes, tasks, due dates, and files.
4. AI generates a draft case summary and suggested next actions.
5. User reviews, edits, and accepts/rejects AI suggestions.
6. Case timeline records important changes.

## Core user journey 2: Understand case state
1. User opens dashboard.
2. User filters by owner/status/risk.
3. User opens a case.
4. User reads latest human-approved summary.
5. User checks tasks, blockers, files, and activity.
6. User takes next action or assigns it.

## Admin/operator journey
1. Admin manages team members and roles.
2. Admin configures statuses, templates, and retention defaults.
3. Admin reviews audit trail and exports data if needed.

## Failure/edge flows
- AI summary fails: user sees clear error and can retry.
- File upload fails: metadata is not saved as if upload succeeded.
- Permission denied: user receives clear access message.
- Deleted/archive case: admin can restore within retention window.
- Conflicting edits: latest update is preserved and activity log records the change.
