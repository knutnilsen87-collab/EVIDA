# LOCAL_DEV_SETUP

## Recommended tools
- Node.js LTS.
- pnpm.
- PostgreSQL local or Docker.
- Git.
- VS Code or preferred editor.

## Environment variables
Expected `.env.local` values:

```text
DATABASE_URL=
AUTH_SECRET=
AUTH_PROVIDER_CLIENT_ID=
AUTH_PROVIDER_CLIENT_SECRET=
OPENAI_API_KEY=
AI_PROVIDER=openai
S3_ENDPOINT=
S3_REGION=
S3_BUCKET=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
APP_URL=http://localhost:3000
```

## Local services
Recommended:
- PostgreSQL in Docker.
- S3-compatible storage through MinIO for local file testing.

## Setup sequence
1. Install dependencies.
2. Copy `.env.example` to `.env.local`.
3. Start local Postgres and storage.
4. Run migrations.
5. Seed demo workspace/user/cases.
6. Start dev server.
7. Run test suite.

## Seed data
Seed should create:
- One workspace.
- One admin.
- One manager.
- One collaborator.
- Five sample cases with different statuses.
- Notes, tasks, and one AI draft.

## Developer quality commands
Use scripts equivalent to:

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm db:migrate
pnpm db:seed
```

## Local safety rules
- Never use production credentials locally.
- Never run destructive migration commands against production by default.
- Keep local file storage separate from production storage.
