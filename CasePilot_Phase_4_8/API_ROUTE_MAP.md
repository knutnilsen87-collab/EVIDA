# API_ROUTE_MAP

## Route style
Use server actions or route handlers consistently. If using Next.js App Router, keep mutations close to domain modules and enforce authorization server-side.

## Auth/session
- GET /api/session
- POST /api/auth/invite
- POST /api/auth/accept-invite

## Workspaces
- GET /api/workspaces
- POST /api/workspaces
- GET /api/workspaces/:workspaceId
- PATCH /api/workspaces/:workspaceId

## Memberships
- GET /api/workspaces/:workspaceId/members
- POST /api/workspaces/:workspaceId/members/invite
- PATCH /api/workspaces/:workspaceId/members/:membershipId
- DELETE /api/workspaces/:workspaceId/members/:membershipId

## Cases
- GET /api/workspaces/:workspaceId/cases
- POST /api/workspaces/:workspaceId/cases
- GET /api/workspaces/:workspaceId/cases/:caseId
- PATCH /api/workspaces/:workspaceId/cases/:caseId
- POST /api/workspaces/:workspaceId/cases/:caseId/archive
- POST /api/workspaces/:workspaceId/cases/:caseId/restore

## Case collaborators
- GET /api/workspaces/:workspaceId/cases/:caseId/collaborators
- POST /api/workspaces/:workspaceId/cases/:caseId/collaborators
- DELETE /api/workspaces/:workspaceId/cases/:caseId/collaborators/:userId

## Notes
- GET /api/workspaces/:workspaceId/cases/:caseId/notes
- POST /api/workspaces/:workspaceId/cases/:caseId/notes
- PATCH /api/workspaces/:workspaceId/cases/:caseId/notes/:noteId
- POST /api/workspaces/:workspaceId/cases/:caseId/notes/:noteId/archive

## Tasks
- GET /api/workspaces/:workspaceId/cases/:caseId/tasks
- POST /api/workspaces/:workspaceId/cases/:caseId/tasks
- PATCH /api/workspaces/:workspaceId/cases/:caseId/tasks/:taskId
- POST /api/workspaces/:workspaceId/cases/:caseId/tasks/:taskId/archive

## Files
- POST /api/workspaces/:workspaceId/cases/:caseId/files/presign
- POST /api/workspaces/:workspaceId/cases/:caseId/files/complete
- GET /api/workspaces/:workspaceId/cases/:caseId/files
- POST /api/workspaces/:workspaceId/cases/:caseId/files/:fileId/archive
- GET /api/workspaces/:workspaceId/cases/:caseId/files/:fileId/download-url

## AI
- POST /api/workspaces/:workspaceId/cases/:caseId/ai/summaries
- GET /api/workspaces/:workspaceId/cases/:caseId/ai/summaries
- POST /api/workspaces/:workspaceId/cases/:caseId/ai/summaries/:summaryId/approve
- POST /api/workspaces/:workspaceId/cases/:caseId/ai/summaries/:summaryId/reject
- PATCH /api/workspaces/:workspaceId/cases/:caseId/ai/summaries/:summaryId

## Dashboard/reporting
- GET /api/workspaces/:workspaceId/dashboard
- GET /api/workspaces/:workspaceId/reports/case-health

## Audit
- GET /api/workspaces/:workspaceId/audit-logs

## Required authorization helper
Every route should call a shared helper equivalent to:
- requireSession()
- requireWorkspaceMembership(workspaceId)
- requireCaseAccess(workspaceId, caseId)
- requireRole(workspaceId, allowedRoles)

## Error format
Use consistent JSON:

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have access to this resource."
  }
}
```
