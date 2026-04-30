# PHASE_1_3_SUMMARY

## Phase 1: Discovery and scope
CasePilot is defined as an AI-assisted case workspace for teams that need to manage structured cases, notes, tasks, files, status, ownership, and next actions.

The MVP should focus on case clarity, not broad CRM/project-management functionality.

## Phase 2: Product design
The core product experience is:
1. Create case.
2. Add context, notes, tasks, and files.
3. Generate AI draft summary and next steps.
4. Human reviews AI output.
5. Team progresses case through status and tasks.
6. Manager sees portfolio health.

The UI should be desktop-first, operational, scan-friendly, and permission-aware.

## Phase 3: Technical architecture
Recommended architecture:
- Next.js + TypeScript.
- PostgreSQL.
- Prisma or Drizzle.
- Proven auth provider.
- Private object storage.
- AI provider abstraction.
- Modular monolith first.
- Strong audit and permission model from the start.

## Recommended next phase
Phase 4 should produce implementation-ready artifacts:
- Database schema.
- API route map.
- UI screen map/wireframes.
- Ticket backlog.
- Test plan.
- Local development setup.

## Current phase count estimate
CasePilot still needs approximately 5 more major phases after this:
4. MVP implementation plan and backlog.
5. Build MVP.
6. AI/evaluation hardening.
7. Production hardening and beta.
8. Launch.
