"""M3 persist_test_record: STUB. Returns test_record_id="stub-<uuid>".

M4 will plug Spring's TestRecordController via AiProxyService.
For M3, the data flow is logged; no DB write.
"""
from __future__ import annotations

import logging
import uuid

from app.graphs.state import PsychTestState

log = logging.getLogger(__name__)


async def persist_test_record(state: PsychTestState) -> dict:
    record_id = f"stub-{uuid.uuid4().hex[:12]}"
    log.warning(
        "STUB persist_test_record: would have POSTed TestRecord to Spring; "
        "returning stub id=%s. M4 plugs real persistence.",
        record_id,
    )
    return {"test_record_id": record_id, "phase": "reporting"}
