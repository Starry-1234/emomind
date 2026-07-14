import pytest
import uuid
from app.memory.long_term import UserMemoryStore, MemoryFact


@pytest.mark.asyncio
async def test_long_term_upsert_and_retrieve_top_k():
    try:
        store = await UserMemoryStore.create()
    except Exception as e:
        pytest.skip(f"Postgres unavailable: {e}")

    user_id = str(uuid.uuid4())
    # Insert 3 facts
    emb_a = [0.1] * 1024
    emb_b = [0.2] * 1024
    emb_c = [0.9] * 1024
    await store.upsert_fact(user_id, "favorite_color", "blue", 0.8, emb_a)
    await store.upsert_fact(user_id, "hobby", "reading", 0.7, emb_b)
    await store.upsert_fact(user_id, "city", "shanghai", 0.6, emb_c)

    # Query similar to emb_c (shanghai) should return city first
    facts = await store.retrieve(user_id, "where do you live", top_k=3)
    assert len(facts) == 3
    assert facts[0].key == "city"
