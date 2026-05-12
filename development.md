# Development Guide

## Local Setup

### Prerequisites

- Docker & Docker Compose
- Bun (frontend, `npm install -g bun`)
- uv (backend, `pip install uv`)

### Start the Stack

```bash
docker compose watch
```

This starts all services with live code reloading for backend and frontend.

To start without watch:

```bash
docker compose up -d
```

### Frontend

Runs on http://localhost:5173

```bash
cd frontend
bun install
bun run dev
```

### Backend

Runs on http://localhost:8000, API docs at http://localhost:8000/docs

```bash
cd backend
uv sync
fastapi dev app/main.py
```

Backend has hot reload enabled during `docker compose up`.

### Database Migrations

Create a new migration after changing models:

```bash
docker compose exec backend bash
alembic revision --autogenerate -m "description of change"
alembic upgrade head
```

### Generate API Client

After modifying backend API routes, regenerate the frontend client:

```bash
bash ./scripts/generate-client.sh
```

### Run Tests

```bash
# Backend tests (in running stack)
docker compose exec backend bash scripts/tests-start.sh -x

# Frontend E2E tests
bunx playwright test
bunx playwright test --ui  # UI mode
```

## Env Files

Copy and fill in values:

```bash
cp .env.example .env        # root - backend config
cp frontend/.env.example frontend/.env
```

Key variables in `.env`:

- `SECRET_KEY` — JWT signing key, change to a random string
- `POSTGRES_PASSWORD` — database password
- `FIRST_SUPERUSER_PASSWORD` — initial admin password
- `VITE_API_URL` — frontend points to backend (http://localhost:8000 for local)

## Reset Database

```bash
docker compose down -v
docker compose up -d
docker compose exec backend bash -c "alembic upgrade head && python app/initial_data.py"
```
