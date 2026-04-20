# Contributing to anki-cloud

Thanks for your interest in contributing. This guide covers everything you need to get started.

---

## Dev environment setup

**Prerequisites:** Docker, [Bun](https://bun.sh), Node.js 20+, [adr-tools](https://github.com/npryce/adr-tools)

```bash
git clone https://github.com/danielpmichalski/anki-cloud
cd anki-cloud
bun install
cp .env.example .env   # fill in SIDECAR_TOKEN and JWT_SECRET at minimum
```

Start the full local stack:

```bash
# Standalone mode — no Google Drive or OAuth setup required
docker compose -f docker-compose.yml -f docker-compose.standalone.yml up
```

See [README.md](README.md) for cloud mode and local sync-server build options.

---

## Conventional commits

All commits **must** follow [Conventional Commits](https://www.conventionalcommits.org/). This drives automated changelog generation and semantic versioning via release-please.

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

| Type       | When to use                                      |
|------------|--------------------------------------------------|
| `feat`     | New feature (triggers minor version bump)        |
| `fix`      | Bug fix (triggers patch bump)                    |
| `docs`     | Documentation only                               |
| `chore`    | Maintenance, dependencies, config                |
| `refactor` | Code change with no feature or fix               |
| `test`     | Adding or updating tests                         |
| `ci`       | CI/CD pipeline changes                           |

A `BREAKING CHANGE:` footer (or `!` after the type) triggers a major version bump.

### Examples

```
feat(api): add POST /v1/decks endpoint
fix(auth): handle expired refresh token on Google Drive callback
docs: add self-hosting guide
chore: bump anki-cloud-sync image to v25.09-r5
feat(sync)!: change hkey derivation algorithm

BREAKING CHANGE: existing sync sessions will be invalidated
```

### Scopes

Use the package or layer name: `api`, `db`, `web`, `sync`, `auth`, `e2e`, `docs`, `ci`.

---

## ADR process

Architecture decisions are documented as ADRs in `docs/decisions/`. Read [ADR-0001](docs/decisions/0001-record-architecture-decisions.md) for the rationale.

### Proposing a change

1. Open a GitHub issue describing the problem and your proposed approach.
2. Once there's rough agreement, create the ADR:
   ```bash
   adr new "<title>"
   ```
3. Fill in the context, decision, and consequences. Follow the conventions in [CLAUDE.md § 11](CLAUDE.md).
4. If the ADR supersedes an existing one, mark the old ADR `Superseded by [ADR-NNNN]` and link back.
5. Update `CLAUDE.md` to reference the new ADR in the relevant section.
6. Submit a PR with both the ADR file and any `CLAUDE.md` updates.

### Key conventions

- ADRs are **immutable once accepted** — never edit a merged ADR. Supersede it instead.
- No forward references — an ADR may only reference lower-numbered ADRs.
- Keep principles and implementations separate (e.g. "use OAuth2" vs "use Google as OAuth provider").

---

## PR process

1. **Branch** off `main`: `git checkout -b feat/my-feature`
2. Keep PRs focused — one logical change per PR.
3. All commits must follow the conventional commit format above.
4. Run `bun run typecheck` in `api/` before pushing.
5. Run e2e tests if touching sync, auth, or storage code (see [Running tests](#running-tests)).
6. Open the PR against `main`. Fill in the summary and test plan in the PR description.
7. At least one review approval is required before merging.

---

## Running tests

### Type checking

```bash
cd api && bun run typecheck
```

### E2E tests

E2E tests require the full stack running in standalone mode:

```bash
docker compose -f docker-compose.yml -f docker-compose.standalone.yml up -d
cd e2e && bun test src/tests --timeout 30000
```

---

## Project structure

```
api/     REST API + auth (TypeScript / Hono on Bun)
db/      Drizzle ORM schema + migrations (@anki-cloud/db)
web/     Account management UI (Vite + React)
e2e/     End-to-end tests
docs/    Docusaurus narrative docs + ADRs
```

See [CLAUDE.md](CLAUDE.md) for full architecture documentation.
