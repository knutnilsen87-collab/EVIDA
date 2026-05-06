# SECURITY_PRIVACY_CHECKLIST

## Authentication
- [ ] Strong auth provider configured.
- [ ] Production callback URLs correct.
- [ ] Session handling reviewed.
- [ ] Invite flow cannot be abused.

## Authorization
- [ ] Workspace membership required for all workspace data.
- [ ] Case access checked server-side.
- [ ] Admin actions require admin role.
- [ ] Manager actions require manager/admin role.
- [ ] File download requires case access.

## Data isolation
- [ ] All case queries scoped by workspace_id.
- [ ] Tests cover cross-workspace access denial.
- [ ] Audit logs scoped by workspace.

## Files
- [ ] Bucket/private storage is not public.
- [ ] Download URLs expire.
- [ ] Upload completion validates expected file metadata.
- [ ] File archive does not expose stale URLs.

## AI
- [ ] AI receives only necessary case context.
- [ ] AI outputs stored as drafts.
- [ ] Prompt/model/provider metadata stored.
- [ ] Sensitive AI failures do not leak secrets.
- [ ] Rate limit exists.

## Secrets
- [ ] No secrets in repository.
- [ ] Local/dev/staging/prod envs separated.
- [ ] Production keys rotated if exposed.

## Compliance basics
- [ ] Privacy policy drafted.
- [ ] Terms drafted.
- [ ] Data processing notes drafted.
- [ ] User deletion/deactivation behavior defined.
- [ ] Export path defined.

## Pre-launch blocker
Any unchecked item under Authentication, Authorization, Data isolation, Files, AI, or Secrets should block public launch.
