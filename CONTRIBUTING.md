# Contributing to emomind

## Before You Start

For significant changes (new features, refactoring, architectural changes), open an issue first to discuss the idea. This saves everyone time.

Small changes like fixing typos or obvious bugs can go straight to a PR.

## Development Setup

See [development.md](development.md) for setup instructions.

## Pull Requests

- Keep each PR focused on one thing
- Run tests before submitting
- Update relevant documentation if you change functionality
- Reference related issues in the description

## Code Style

Backend uses `pre-commit` hooks (black, ruff). Frontend uses Biome for linting.

```bash
# Backend
cd backend && uv run prek run --all-files

# Frontend
cd frontend && bun run lint
```

## API Changes

If you modify backend API routes, regenerate the frontend client:

```bash
bash ./scripts/generate-client.sh
```

## Database Migrations

After changing models, create and apply a migration:

```bash
alembic revision --autogenerate -m "describe the change"
alembic upgrade head
```
