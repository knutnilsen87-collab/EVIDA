# PHASE_7_PRODUCTION_HARDENING_BETA

## Objective
Prepare CasePilot for real pilot users with production-grade reliability, security, observability, and support paths.

## Production environment
Required:
- Production database.
- Staging database.
- Managed backups.
- Private object storage.
- Production auth configuration.
- AI provider production key.
- Error tracking.
- Structured logs.
- Domain/subdomain.

## Security hardening
Checklist:
- Server-side authorization on every protected route.
- Workspace isolation tests.
- Role permission tests.
- Private file access.
- No public object storage bucket.
- Secrets only in environment manager.
- Rate limits for auth, invite, file, and AI endpoints.
- Audit log for sensitive actions.
- Dependency vulnerability scan.
- Secure headers.

## Data protection
Required:
- Backup schedule.
- Restore rehearsal.
- Data export path.
- Archive/retention policy draft.
- Clear AI data handling note.
- Delete/deactivate user behavior defined.

## Observability
Track:
- App errors.
- API latency.
- AI latency and failure rate.
- AI cost/tokens if available.
- Case creation/update events.
- File upload failures.
- Auth/invite failures.

Alerts:
- App error spike.
- Database connection issues.
- AI provider failure spike.
- File upload failure spike.
- Backup failure.

## Beta readiness
Pilot group:
- 3-10 users.
- 20-50 real cases.
- One admin/manager champion.
- Defined feedback channel.
- Weekly review cadence.

Beta onboarding:
- Invite users.
- Explain AI draft/review model.
- Explain data sensitivity boundaries.
- Provide short getting-started guide.
- Provide bug/feedback process.

## Support process
Minimum:
- Issue intake channel.
- Severity labels.
- Response expectations.
- Known issues list.
- Rollback owner.

Severity:
- P0: data loss, cross-workspace exposure, auth failure.
- P1: core workflow blocked.
- P2: degraded workflow.
- P3: polish/minor issue.

## Beta exit criteria
- No open P0/P1 issues.
- Backup restore tested.
- Core workflows used by pilot users.
- AI output accepted or edited on real cases.
- Feedback themes are understood.
- Product direction still validated after real usage.

## Do not proceed to launch if
- Workspace isolation has not been tested.
- File privacy is uncertain.
- AI can bypass review.
- Backups are untested.
- No one owns support/rollback.
