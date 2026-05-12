# emomind

A psychological assessment platform with AI chat integration, online testing, and audio/video recording.

## Features

- User authentication (admin / regular user)
- AI-powered psychological assessment with Dify integration
- Chat-based psychological Q&A
- Online psychological tests with dynamic scoring
- AI-generated analysis reports
- Dark / light / warm theme support

## Tech Stack

**Backend**: FastAPI + SQLModel + PostgreSQL + JWT

**Frontend**: React 19 + TypeScript + Vite + TanStack Router + TanStack Query + Tailwind CSS + shadcn/ui

**Infra**: Docker Compose + Traefik + Mailcatcher

## Quick Start

```bash
# Start the full stack with hot reload
docker compose watch

# Or start normally
docker compose up -d
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |
| Adminer (DB) | http://localhost:8080 |
| Traefik | http://localhost:8090 |
| Mailcatcher | http://localhost:1080 |

## First Login

Create a superuser in the backend container:

```bash
docker compose exec backend bash
```

Inside the container:

```bash
alembic upgrade head
python app/initial_data.py
```

Default superuser credentials (change after first login):

- Email: `admin@fastapi`
- Password: `changethis`

## Dev Commands

```bash
# Frontend
bun run dev

# Backend (from backend/ directory)
cd backend && fastapi dev app/main.py

# Run tests
bash ./scripts/test.sh

# Generate API client after backend changes
bash ./scripts/generate-client.sh
```

## Project Structure

```
backend/app/
  main.py          # FastAPI app factory
  models.py        # SQLModel models (User, Item, TestRecord, etc.)
  crud.py          # Database operations
  api/routes/      # API endpoints

frontend/src/
  routes/          # Page components by route
  components/      # UI components
  hooks/           # Custom React hooks
  services/        # API service modules
  client/          # Auto-generated OpenAPI client
```

## Env Files

Sensitive config goes in `.env` (not committed). Use `.env.example` as template.

Frontend env: `frontend/.env`, `frontend/.env.example`

Backend env: `.env`
