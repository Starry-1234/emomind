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

## Environment Setup

All configuration is managed in a single `.env` file at the project root (shared by both backend and frontend):

```bash
cp .env.example .env
```

Key variables to configure:

- `SECRET_KEY` — JWT signing key, change to a random string
- `POSTGRES_PASSWORD` — Database password
- `FIRST_SUPERUSER_PASSWORD` — Initial admin password
- `DIFY_API_URL` — Dify API endpoint (use `http://your-host-ip/v1` for Docker on Windows)
- `DIFY_AI_DOCTOR_API_KEY` — Dify API key for AI doctor
- `DIFY_TEST_API_KEY` — Dify API key for psychological tests
- `VITE_API_URL` — Frontend-to-backend address (`http://localhost:8000` for local dev)

### Dify Configuration

This project integrates with the Dify AI platform for AI psychological doctor and testing features. Configure the following environment variables:

```env
DIFY_API_URL=http://your-host-ip/v1
DIFY_AI_DOCTOR_API_KEY=your_ai_doctor_api_key
DIFY_TEST_API_KEY=your_test_api_key
```

Get API keys from the Dify platform after creating your applications.

### Windows Docker Notes

On Windows with Docker Desktop, `host.docker.internal` may not resolve correctly. Use your host's real LAN IP:

1. Run `ipconfig` to find your IPv4 address (e.g., `192.168.1.4`)
2. Set `DIFY_API_URL` in `.env`:
   ```env
   DIFY_API_URL=http://192.168.1.4/v1
   ```

Ensure Dify binds to `0.0.0.0:80` (not just `127.0.0.1`) so containers can reach it.

### Frontend Environment Variables

The frontend reads `VITE_*` prefixed variables from the root `.env` via `envDir: "../"` in `vite.config.ts`.

**No need to maintain a separate `frontend/.env` file.**

## Reset Database

```bash
docker compose down -v
docker compose up -d
docker compose exec backend bash -c "alembic upgrade head && python app/initial_data.py"
```
