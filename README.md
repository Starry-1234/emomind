# EmoMind

[中文版](README.zh-CN.md)

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
  - System statistics

- **Themes**
  - Dark / light / warm theme support

## Tech Stack

**Backend**: Spring Boot 3.2 + Java 17 + Maven + Spring Data JPA + Spring Security + PostgreSQL

**Frontend**: React 19 + TypeScript + Vite + TanStack Router + TanStack Query + Tailwind CSS + shadcn/ui

**AI Integration**: Dify AI Platform (streaming chat, workflow, conversation management)

**Infra**: Docker Compose + Traefik + Nginx + Mailcatcher

## Quick Start

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| [Docker Desktop](https://www.docker.com/products/docker-desktop) | Latest | Run PostgreSQL, Traefik, Mailcatcher, and production builds |
| [Git](https://git-scm.com/) | Latest | Clone the repository |
| [Bun](https://bun.sh/) | 1.x | Frontend package manager and dev server |
| [JDK](https://adoptium.net/) | 17+ | Spring Boot backend runtime |
| [Maven](https://maven.apache.org/) | 3.9+ | Java dependency management |

> **Windows users**: Make sure Docker Desktop is running in WSL2 mode and the "Docker Desktop WSL 2 backend" feature is enabled.

### 1. Clone the Project

```bash
git clone https://github.com/Starry-1234/emomind.git
cd emomind
```

### 2. Deploy Dify (Required)

EmoMind relies on [Dify](https://github.com/langgenius/dify) for AI chat and test workflows. You must run your own Dify instance before starting EmoMind.

#### Option A: Docker Compose (Recommended)

```bash
# In a separate directory
git clone https://github.com/langgenius/dify.git
cd dify/docker
cp .env.example .env
docker compose up -d
```

After startup, open `http://localhost/install` in your browser to complete the Dify initialization (create an admin account).

#### Option B: Source Code (Local Run)

Follow the [Dify official guide](https://docs.dify.ai/getting-started/install-self-hosted/local-source-code) to run the API server (`flask run --host 0.0.0.0 --port 5001`) and the web frontend separately.

#### Configure `DIFY_API_URL`

The value depends on how Dify and EmoMind's backend are deployed:

| Scenario | `DIFY_API_URL` value |
|----------|----------------------|
| Both Dify and EmoMind backend run **outside** Docker | `http://localhost:5001/v1` |
| Dify runs in Docker, EmoMind backend runs **outside** Docker | `http://localhost:5001/v1` |
| Dify runs **outside** Docker, EmoMind backend runs **inside** Docker | Use your **host LAN IP** (e.g. `http://192.168.1.5:5001/v1`). `host.docker.internal` often does not work on Windows. |
| Both Dify and EmoMind backend run in Docker on the **same host** | Use your **host LAN IP** (e.g. `http://192.168.1.5/v1`). On Windows, `host.docker.internal` is unreliable; use the real IP. |

> **How to find your LAN IP (Windows)**: Open PowerShell and run `ipconfig`. Look for "IPv4 Address" under your active network adapter (usually starts with `192.168.`).

### 3. Import Dify Workflows

Two pre-built workflows are included in the `dify_workflow/` directory:

| File | Purpose |
|------|---------|
| `dify_workflow/智能心理医生_v0.1.yml` | AI Doctor chat workflow |
| `dify_workflow/智能心理测评_v0.1.yml` | Psychological test workflow |

**Import steps**:
1. Open Dify Studio (`http://localhost` after Dify setup)
2. Click **Create Application** → **Import DSL**
3. Select the `.yml` file from the `dify_workflow/` folder
4. Repeat for both workflows

**Get the API Keys**:
1. Enter each imported application
2. Go to **API Access** in the left sidebar
3. Click **Generate API Key**
4. Copy the key — you will paste it into EmoMind's `.env` file:
   - `智能心理医生` key → `DIFY_AI_DOCTOR_API_KEY`
   - `智能心理测评` key → `DIFY_TEST_API_KEY`

### 4. Configure EmoMind Environment

```bash
cp .env.example .env
```

Edit `.env` and set at least these variables:

```env
# Security — change these from defaults!
SECRET_KEY=your-random-secret-string
POSTGRES_PASSWORD=your-db-password
FIRST_SUPERUSER_PASSWORD=your-admin-password

# Dify connection
DIFY_API_URL=http://your_lan_ip:5001/v1   # See table above
DIFY_AI_DOCTOR_API_KEY=your-ai-doctor-key
DIFY_TEST_API_KEY=your-test-key

# Frontend
VITE_API_URL=http://localhost:8080
```

### 5. Start EmoMind (Development Mode)

Development mode runs the backend and frontend **outside** Docker for fast hot-reload, while PostgreSQL and other services run inside Docker.

**Step 1 — Infrastructure services**:

```bash
docker compose -f compose.override.yml up -d db mailcatcher
```

This starts PostgreSQL (port `5433`) and Mailcatcher (port `10801`).

**Step 2 — Backend**:

```bash
cd backend-sb
set -a && source ../.env && set +a && mvn spring-boot:run
```

> `set -a` ensures variables loaded by `source ../.env` are exported as environment variables; otherwise Spring Boot won't read the `.env` config. Wait for `Started EmoMindApplication in ... seconds`.

**Step 3 — Frontend**:

```bash
cd frontend
bun install
bun run dev
```

Open http://localhost:5174 in your browser.

### 6. Deploy EmoMind (Production Mode)

Production mode builds everything into Docker images and runs them behind Traefik.

```bash
# Build images and start all services
docker compose up -d --build
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost |
| Backend API | http://localhost:8080 |
| Swagger UI | http://localhost:8080/swagger-ui.html |
| Traefik Dashboard | http://localhost:8091 |
| Adminer (DB) | http://localhost:8082 |

To stop:

```bash
docker compose down
```

### Development vs Deployment Mode

| | Development Mode | Deployment Mode |
|--|------------------|-----------------|
| **Backend** | `mvn spring-boot:run` (local JVM, hot reload, source `.env` first) | Docker container (`docker compose up`) |
| **Frontend** | `bun run dev` (Vite dev server, HMR) | Docker container (Nginx serving static build) |
| **Database** | Docker (`db` service from `compose.override.yml`) | Docker (`db` service from `compose.yml`) |
| **Proxy** | None (direct ports) | Traefik (reverse proxy + HTTPS) |
| **Use case** | Daily coding, debugging | Production server, demo, CI/CD |

## Documentation

All design documents are in the `doc/` directory:

| Document | Description |
|----------|-------------|
| `doc/README.md` | Documentation index and reading order |
| `doc/requirements.md` | Functional and non-functional requirements |
| `doc/outline-design.md` | System architecture and module design |
| `doc/detailed-design.md` | Database, API, class, and configuration details |
| `doc/tasks/*.md` | Per-feature task breakdown with checklists |

## Project Structure

```
emomind-sb/
├── backend-sb/           # Spring Boot backend
│   ├── pom.xml
│   └── src/main/java/com/emomind/
│       ├── controller/   # REST API controllers
│       ├── service/      # Business logic
│       ├── repository/   # Spring Data JPA repositories
│       ├── entity/       # JPA entities
│       ├── dto/          # Request/response DTOs
│       ├── mapper/       # Entity-DTO mappers
│       ├── exception/    # Custom exceptions
│       ├── security/     # JWT and authentication
│       ├── config/       # Configuration classes
│       └── resources/
│           ├── application.yml
│           └── db/migration/   # Flyway migrations
├── frontend/             # React SPA
│   ├── src/
│   │   ├── routes/       # TanStack Router pages
│   │   ├── components/   # Shared UI components
│   │   ├── hooks/        # React hooks (chat, auth, etc.)
│   │   ├── services/     # API clients
│   │   └── client/       # Auto-generated OpenAPI client
│   └── dist/             # Production build output
├── dify_workflow/        # Dify workflow DSL files
├── doc/                  # Design documentation
├── compose.yml           # Docker Compose production config
├── compose.override.yml  # Docker Compose development config
├── scripts/              # Build and utility scripts
└── .env.example          # Environment variable template
```

## Development Environment Ports

| Service | Port |
|---------|------|
| Frontend | http://localhost:5174 |
| Backend API | http://localhost:8080 |
| API Docs (Swagger UI) | http://localhost:8080/swagger-ui.html |
| Adminer (DB) | http://localhost:8082 |
| Traefik Dashboard | http://localhost:8091 |
| Mailcatcher | http://localhost:10801 |
| PostgreSQL | localhost:5433 |

## Dev Commands

```bash
# Frontend development (from frontend/ directory)
cd frontend && bun install && bun run dev

# Backend development (from backend-sb/ directory, source .env first)
cd backend-sb && set -a && source ../.env && set +a && mvn spring-boot:run

# Run backend tests
cd backend-sb && mvn test

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
