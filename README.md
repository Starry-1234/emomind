# EmoMind

A psychological assessment platform with AI chat integration, online testing, file analysis, and multi-theme support.

## Current Status

**Phase**: Design documentation complete, awaiting Phase 2 (project scaffolding).

This branch (`emomind-sb`) is migrating the backend from FastAPI to Spring Boot 3.2 + Java 17. The React frontend remains unchanged.

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
  - System statistics

- **Themes**
  - Dark / light / warm theme support

## Tech Stack

**Backend**: Spring Boot 3.2 + Java 17 + Maven + Spring Data JPA + Spring Security + PostgreSQL

**Frontend**: React 19 + TypeScript + Vite + TanStack Router + TanStack Query + Tailwind CSS + shadcn/ui

**AI Integration**: Dify AI Platform (streaming chat, workflow, conversation management)

**Infra**: Docker Compose + Traefik + Nginx + Mailcatcher

## Documentation

All design documents are in the `doc/` directory:

| Document | Description |
|----------|-------------|
| `doc/README.md` | Documentation index and reading order |
| `doc/requirements.md` | Functional and non-functional requirements |
| `doc/outline-design.md` | System architecture and module design |
| `doc/detailed-design.md` | Database, API, class, and configuration details |
| `doc/tasks/*.md` | Per-feature task breakdown with checklists |

## Planned Project Structure

```
emomind-sb/
├── backend-sb/           # Spring Boot backend (not yet created)
│   ├── pom.xml
│   └── src/main/java/com/emomind/
│       ├── controller/   # REST API controllers
│       ├── service/      # Business logic
│       ├── repository/   # Spring Data JPA repositories
│       ├── entity/       # JPA entities
│       ├── dto/          # Request/response DTOs
│       ├── security/     # JWT and authentication
│       ├── config/       # Configuration classes
│       └── resources/
│           ├── application.yml
│           └── db/migration/   # Flyway migrations
├── frontend/             # React SPA (shared with FastAPI version)
├── doc/                  # Design documentation
├── compose.yml           # Docker Compose production config
├── compose.override.yml  # Docker Compose development config
└── scripts/              # Build and utility scripts
```

## Development Environment Ports

Ports are isolated from the FastAPI version to allow both to run simultaneously:

| Service | Port |
|---------|------|
| Frontend | http://localhost:5174 |
| Backend API | http://localhost:8080 |
| API Docs | http://localhost:8080/docs |
| Adminer (DB) | http://localhost:8082 |
| Traefik Dashboard | http://localhost:8091 |
| Mailcatcher | http://localhost:10801 |
| PostgreSQL | localhost:5433 |

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
- `VITE_API_URL` — Frontend-to-backend address (`http://localhost:8080` for local dev)

> **Note**: On Windows with Docker Desktop, use your host LAN IP (e.g., `192.168.1.x`) for `DIFY_API_URL` instead of `localhost` or `host.docker.internal`.

## Dev Commands (Planned)

```bash
# Frontend development (from frontend/ directory)
cd frontend && bun install && bun run dev

# Backend development (from backend-sb/ directory)
cd backend-sb && ./mvnw spring-boot:run

# Run backend tests
cd backend-sb && ./mvnw test

# Generate API client after backend changes
bash ./scripts/generate-client.sh
```

## API Overview

- `/api/v1/login` — Authentication
- `/api/v1/users` — User management
- `/api/v1/test-records` — Psychological test records
- `/api/v1/analysis` — File analysis reports
- `/api/v1/dify/*` — Dify AI integration (chat, conversations, messages)
- `/api/v1/admin` — Admin statistics and management
- `/api/v1/utils/health-check` — Health check

## Relationship with FastAPI Version

- `emomind/` (sibling directory) = `emo-fastapi_v3` branch, continues FastAPI development
- `emomind-sb/` (this directory) = `emomind-sb` branch, Spring Boot re-implementation
- Frontend code is synchronized between both branches
