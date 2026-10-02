# Agent Development Guide

## Commands

- `pnpm dev` - Start all dev servers
- `pnpm build` - Build all packages and apps
- `pnpm check` - Run all checks (format, lint, types); `pnpm check:lint`, `pnpm check:types` run one
- `pnpm fix` - Auto-fix format and lint issues
- `pnpm turbo run <command> --filter=<package>` - Target one package or app
- `pnpm --filter=@plane/ui storybook` - Start Storybook on port 6006

## Conventions

- Use `workspace:*` for internal packages and `catalog:` for external dependencies.
- Format with oxfmt (`pnpm fix:format`); lint with OxLint and the shared `.oxlintrc.json`.
- MobX stores live in `packages/shared-state`.
- Build components in `@plane/ui` with Storybook.

## Backend tests (Docker)

The Django/pytest suite for `apps/api` runs in an isolated stack defined by `docker-compose-test.yml` at the repo root.

Prereq (once): `./setup.sh` - generates `apps/api/.env` from `.env.example`.

- Full suite: `docker compose -f docker-compose-test.yml up --build --abort-on-container-exit --exit-code-from api-tests`
- Subset: `docker compose -f docker-compose-test.yml run --rm api-tests pytest -m unit`
- Teardown: `docker compose -f docker-compose-test.yml down -v`

Walkthrough and troubleshooting: `apps/api/tests/RUNNING_TESTS.md`.
