# PHASE_8_LAUNCH_PLAN

## Objective
Launch Evida as a controlled production product.

## Launch type
Recommended: controlled private launch, not broad public launch.

## Launch prerequisites
- Production deploy stable.
- Domain configured.
- Backups verified.
- Monitoring enabled.
- Error tracking enabled.
- Privacy/terms pages ready.
- Support process ready.
- Rollback plan ready.
- First user onboarding process ready.

## Launch sequence
1. Freeze MVP scope.
2. Complete security/privacy checklist.
3. Run production smoke test.
4. Invite first admin users.
5. Create first production workspace.
6. Import/create initial cases.
7. Monitor errors and AI failures.
8. Collect feedback daily for first week.
9. Fix P0/P1 immediately.
10. Decide whether to expand beta.

## Production smoke test
- Sign in.
- Create workspace.
- Invite user.
- Create case.
- Add note.
- Add task.
- Upload file.
- Generate AI summary draft.
- Approve edited summary.
- Verify audit log.
- Verify dashboard updates.

## Rollback plan
Minimum:
- Previous deploy can be restored.
- Database migrations are backward-compatible or have rollback notes.
- Feature flags can disable AI generation.
- File uploads can be temporarily disabled if storage issue occurs.
- Support message ready for users if incident occurs.

## Launch metrics
Operational:
- Error rate.
- API latency.
- AI failure rate.
- File upload failure rate.
- Active users.

Product:
- Cases created.
- Cases with owner/status/risk/next action.
- AI summaries generated.
- AI summaries approved/edited/rejected.
- Overdue tasks.
- Weekly active teams.

## First 30 days
Week 1:
- Watch stability.
- Fix onboarding friction.
- Fix P0/P1 immediately.

Week 2:
- Review AI quality.
- Improve prompts/evals.
- Improve dashboard/list workflows.

Week 3:
- Decide first niche positioning.
- Prioritize integrations or reporting based on usage.

Week 4:
- Decide whether to add billing, expand beta, or continue product discovery.

## Launch exit criteria
- First users are onboarded.
- Core workflows are used with real cases.
- Monitoring shows stable behavior.
- No open P0/P1.
- Feedback loop is active.
