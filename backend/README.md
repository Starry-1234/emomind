# Backend

## Tech Stack

FastAPI + SQLModel + PostgreSQL + Alembic + JWT

## Start

```bash
cd backend
uv sync
fastapi dev app/main.py
```

Or with Docker:

```bash
docker compose up -d backend
```

## Dependencies

```bash
uv sync
```

## Database Migrations

```bash
# Create migration after model change
alembic revision --autogenerate -m "describe change"

# Apply migrations
alembic upgrade head
```

## Tests

```bash
bash ./scripts/test.sh
```

## API Routes

Located in `app/api/routes/`:
- `login.py` — Authentication
- `users.py` — User management
- `items.py` — Item management
- `analysis.py` — File analysis reports
- `test_records.py` — Psychological test records
- `utils.py` — Health check
- `private.py` — Local dev endpoints
