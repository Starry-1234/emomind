# emomind

A psychological assessment platform with AI chat integration, online testing, file analysis, and multi-theme support.

## Features

- **User Authentication**
  - JWT-based login/register with role-based access control (admin / regular user)
  - Password recovery and reset

- **AI Psychological Doctor**
  - Dify AI-powered chat for psychological Q&A
  - Streaming response with pause/continue support
  - Message copy and regenerate with multi-version switching
  - Conversation history management

- **Online Psychological Tests**
  - Interactive psychological assessment scales
  - Real-time scoring and progress tracking
  - AI-generated analysis reports
  - Test record history

- **File Analysis**
  - Upload psychological assessment files for AI analysis
  - Generated analysis reports with downloadable results

- **Admin Dashboard**
  - User management
  - Chat history overview
  - Test records management
  - System settings

- **Themes**
  - Dark / light / warm theme support

## Tech Stack

**Backend**: FastAPI + SQLModel + PostgreSQL + JWT + Alembic

**Frontend**: React 19 + TypeScript + Vite + TanStack Router + TanStack Query + Tailwind CSS + shadcn/ui

**AI Integration**: Dify AI Platform (streaming chat, workflow, conversation management)

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

- Email: `admin@example.com`
- Password: `changethis`

## Environment Setup

All configuration is in a single `.env` file at the project root (shared by both backend and frontend):

```bash
cp .env.example .env
```

Key variables to configure:

- `SECRET_KEY` — JWT signing key, change to a random string
- `POSTGRES_PASSWORD` — Database password
- `FIRST_SUPERUSER_PASSWORD` — Initial admin password
- `DIFY_API_URL` — Dify API endpoint (use `http://192.168.x.x/v1` for Docker on Windows)
- `DIFY_AI_DOCTOR_API_KEY` — Dify API key for AI doctor
- `DIFY_TEST_API_KEY` — Dify API key for psychological tests
- `VITE_API_URL` — Frontend-to-backend address (`http://localhost:8000` for local dev)

> **Note**: On Windows with Docker Desktop, use your host LAN IP (e.g., `192.168.1.x`) for `DIFY_API_URL` instead of `localhost` or `host.docker.internal`.

## Dev Commands

```bash
# Frontend (from frontend/ directory)
cd frontend && bun install && bun run dev

# Backend (from backend/ directory)
cd backend && uv sync && fastapi dev app/main.py

# Run tests
bash ./scripts/test.sh

# Generate API client after backend changes
bash ./scripts/generate-client.sh
```

## Project Structure

```
backend/app/
  main.py               # FastAPI app factory
  models/               # SQLModel models (User, Item, TestRecord, FileAnalysisReport, etc.)
  repositories/         # Repository pattern (CRUD operations)
  services/             # Business logic layer (Dify, Admin, User, Analysis)
  api/routes/           # API endpoints

frontend/src/
  routes/          # Page components by route
  components/      # UI components
  hooks/           # Custom React hooks
  services/        # API service modules (difyApi.ts, analysisApi.ts)
  client/          # Auto-generated OpenAPI client
```

## API Overview

- `/api/v1/login` — Authentication
- `/api/v1/users` — User management
- `/api/v1/test-records` — Psychological test records
- `/api/v1/analysis` — File analysis reports
- `/api/v1/dify/*` — Dify AI integration (chat, conversations, messages)
- `/api/v1/utils` — Health check and utilities
