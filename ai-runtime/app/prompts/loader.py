"""Load and render Jinja2 prompt templates from app/prompts/<graph>/<name>.j2."""
from __future__ import annotations

from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, StrictUndefined

_PROMPTS_DIR = Path(__file__).parent

_env = Environment(
    loader=FileSystemLoader(str(_PROMPTS_DIR)),
    autoescape=False,
    undefined=StrictUndefined,
    trim_blocks=True,
    lstrip_blocks=True,
)

_cache: dict[str, str] = {}


def render_prompt(graph: str, name: str, **vars: Any) -> str:
    """Render app/prompts/<graph>/<name>.j2 with **vars."""
    template_name = f"{graph}/{name}.j2"
    if template_name not in _cache:
        _cache[template_name] = _env.get_template(template_name)
    return _cache[template_name].render(**vars)