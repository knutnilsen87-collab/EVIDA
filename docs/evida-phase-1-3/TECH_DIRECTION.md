# TECH_DIRECTION

## Recommended product type
Web App / SaaS with AI-assisted workflow.

## Preferred stack
Recommended MVP stack:
- Frontend/backend: Next.js with TypeScript.
- UI: React, Tailwind CSS, shadcn/ui or equivalent component primitives.
- Database: PostgreSQL.
- ORM: Prisma or Drizzle.
- Auth: Auth.js, Clerk, or Supabase Auth depending on deployment preference.
- File storage: S3-compatible object storage.
- AI provider abstraction: provider interface with OpenAI-compatible implementation first.
- Hosting: Vercel for app plus managed Postgres/storage, or Railway/Fly.io if backend control is preferred.

## Backend preference
Start as a modular monolith. Avoid microservices in MVP.

## Frontend preference
Server-rendered app shell with client components for interactive tables, filters, case editor, and AI review panel.

## Database preference
PostgreSQL with migrations from day one.

## Auth preference
Use proven auth provider unless there is a strong reason to build auth manually. Workspace membership and role checks must be app-owned.

## File/media/storage needs
Use private object storage. Store file metadata in database. Do not expose public URLs by default.

## Third-party integrations
MVP should only integrate AI provider, auth, database, storage, and email for invites/notifications if needed.

## CI/CD expectations
- Lint.
- Typecheck.
- Unit tests.
- Basic integration tests for permissions and core case APIs.
- Preview deploys.
- Migration checks before production deploy.

## Logging/monitoring expectations
- Structured server logs.
- Error tracking.
- Request IDs.
- Audit log in database.
- AI request metadata without storing secrets.

## Performance expectations
- Case list should load quickly for 1,000+ cases per workspace with pagination/filtering.
- AI operations can be async.
- File uploads should not block case editing.

## Security expectations
- Server-side permission checks on every protected route.
- No client-trusted role decisions.
- Environment-based secrets.
- Private file access.
- Audit sensitive actions.
- Rate limit AI endpoints and invitation endpoints.

## AI architecture
- AI outputs are drafts.
- Store prompt version, model, input references, output, user approval status.
- Separate factual summaries from recommendations.
- Allow regenerate/review/approve flow.
- Do not let AI mutate case state without explicit user action.

## What is fixed vs what should be decided later
Fixed for MVP:
- SaaS web app.
- Workspace/case model.
- Human-reviewed AI.
- PostgreSQL-style relational model.

Open:
- Exact auth provider.
- Exact deployment provider.
- Billing timeline.
- Whether first niche is legal, support, compliance, consulting, or general operations.
