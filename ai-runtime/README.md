# ai-runtime (M0 skeleton)

FastAPI-based skeleton for the LangGraph AI runtime. M0 only contains
a `/healthz` endpoint and a `/` info endpoint. Real chat / SSE endpoints
land in M1.

## Run

```bash
uv sync --extra dev
uv run uvicorn app.main:app --reload --port 8000
```

## Test

```bash
uv run pytest -v
```

## Reference

See `../doc/langgraph-migration/09-ai-runtime.md` for full module specification.
