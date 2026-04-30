# TEST_PLAN

## Test strategy
Keep tests focused on production risk:
- Permissions.
- Data integrity.
- Case workflows.
- AI review boundaries.
- File privacy.
- Audit trail.

## Unit tests
- Permission helper behavior by role.
- Case status transition helpers.
- AI output parsing/normalization.
- Input validation schemas.
- Environment validation.

## Integration tests
- User can create workspace.
- User can create/list/update/archive case.
- Non-member cannot access workspace.
- Collaborator cannot perform admin-only actions.
- Case owner can approve AI summary.
- AI summary remains draft until approved.
- File download URL requires access.
- Audit log is created for sensitive actions.

## End-to-end tests
Primary path:
1. Sign in.
2. Create workspace.
3. Create case.
4. Add note.
5. Add task.
6. Generate AI summary.
7. Approve edited summary.
8. See approved summary on case detail.

Manager path:
1. Manager opens dashboard.
2. Filters cases by risk/status/owner.
3. Opens high-risk case.
4. Assigns owner or task.

Admin path:
1. Admin invites user.
2. Changes role.
3. Reviews audit log.

## Manual QA checklist
- Empty states look intentional.
- Loading states do not shift layout badly.
- Error messages are clear.
- Unauthorized states are handled.
- AI draft is visually distinct from approved summary.
- Mobile view is readable.

## Production smoke tests
- Login works.
- Database connection works.
- Case creation works.
- AI generation works.
- File upload/download works.
- Error tracking receives test event.
- Audit log records sensitive action.

## Minimum pre-beta pass condition
- All P0 tests pass.
- No known P0/P1 issues.
- Manual QA completed on desktop and mobile viewport.
