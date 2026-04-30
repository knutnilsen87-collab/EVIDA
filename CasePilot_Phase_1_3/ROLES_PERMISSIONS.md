# ROLES_PERMISSIONS

## User roles
- Admin
- Manager
- Case owner
- Collaborator
- Reviewer

## Role capabilities
Admin:
- Manage workspace, users, roles, templates, retention, exports.
- View audit log.
- Archive/restore cases.

Manager:
- View all workspace cases.
- Assign owners.
- Edit case status, priority, and risk.
- View dashboards and reports.

Case owner:
- Create and edit owned cases.
- Add notes, tasks, files, collaborators.
- Generate and approve AI summaries for owned cases.

Collaborator:
- View assigned cases.
- Add notes, tasks, files.
- Suggest edits.

Reviewer:
- View cases assigned for review.
- Add comments and approvals.
- Approve/reject AI-generated recommendations if configured.

## Sensitive actions
- User/role changes.
- Case deletion/archive/restore.
- Exporting case data.
- Changing retention policy.
- Approving AI-generated summary as official.
- Sharing/inviting external users.

## Ownership rules
- Every active case must have exactly one owner.
- Cases can have many collaborators.
- Admins and managers can reassign ownership.

## Approval/moderation flows
AI suggestions must remain draft until a permitted human marks them as accepted, edited, or rejected.
