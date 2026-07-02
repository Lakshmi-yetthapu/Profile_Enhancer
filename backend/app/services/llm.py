"""Provider-agnostic LLM client. Supports Mistral and OpenAI, selectable per request.

Each provider is asked to return a single JSON object. We parse and return a dict.
"""

from __future__ import annotations

import itertools
import json
from abc import ABC, abstractmethod

from fastapi import HTTPException

from app.config import settings

# Round-robin cursor shared across requests (advances one step per rotated call).
_mistral_rr = itertools.count()


def _rotation_config() -> tuple[int, str]:
    """(active_key_count, mode) from admin settings; safe defaults if DB is unavailable."""
    try:
        from app.database import SessionLocal
        from app.services import appsettings

        db = SessionLocal()
        try:
            active = int(appsettings.get_value(db, "mistral_active_keys") or 0)
            mode = appsettings.get_value(db, "key_rotation_mode") or "round_robin"
        finally:
            db.close()
        return active, mode
    except Exception:
        return 0, "round_robin"


def _mistral_keys_to_try() -> list[str]:
    """Ordered list of Mistral keys to attempt for one request, per rotation settings."""
    keys = settings.mistral_key_list
    if not keys:
        return []
    active, mode = _rotation_config()
    if active and 0 < active < len(keys):
        keys = keys[:active]
    if mode == "single":
        return keys[:1]
    if mode == "round_robin" and len(keys) > 1:
        i = next(_mistral_rr) % len(keys)
        return keys[i:] + keys[:i]  # rotated start, full list for failover
    return keys  # failover: natural order


def _is_retryable(exc: Exception) -> bool:
    """Retry the next key on rate-limit / bad-key / transient errors, but not on
    client-side request errors (e.g. 400/422 won't be fixed by another key)."""
    code = getattr(exc, "status_code", None) or getattr(exc, "code", None)
    if code is None:
        return True  # network / unknown -> try next key
    try:
        code = int(code)
    except (TypeError, ValueError):
        return True
    return code in {401, 403, 408, 409, 425, 429, 500, 502, 503, 504}


class LLMProvider(ABC):
    name: str
    model: str
    embed_model: str

    @abstractmethod
    def complete_json(self, system_prompt: str, user_prompt: str) -> dict:
        ...

    @abstractmethod
    def embed(self, texts: list[str]) -> list[list[float]]:
        """Return one embedding vector per input text."""
        ...


def _extract_json(text: str) -> dict:
    """Best-effort: parse a JSON object, tolerating code fences / surrounding prose."""
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        # remove an optional leading "json" language tag
        if text[:4].lower() == "json":
            text = text[4:]
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            return json.loads(text[start : end + 1])
        raise


class MistralProvider(LLMProvider):
    name = "mistral"

    def __init__(self) -> None:
        if not settings.mistral_key_list:
            raise HTTPException(status_code=400, detail="No Mistral API key is configured")
        self.model = settings.mistral_model
        self.embed_model = settings.mistral_embed_model

    def _run(self, func):
        """Try each rotated key until one succeeds; fail over on rate-limit/bad-key errors."""
        from mistralai import Mistral

        keys = _mistral_keys_to_try()
        if not keys:
            raise HTTPException(status_code=400, detail="No Mistral API key is configured")
        last: Exception | None = None
        for key in keys:
            try:
                return func(Mistral(api_key=key))
            except HTTPException:
                raise
            except Exception as exc:  # noqa: BLE001
                last = exc
                if not _is_retryable(exc):
                    break
        raise HTTPException(
            status_code=502,
            detail=f"Mistral request failed after trying {len(keys)} key(s): {last}",
        )

    def complete_json(self, system_prompt: str, user_prompt: str) -> dict:
        def call(client):
            resp = client.chat.complete(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                response_format={"type": "json_object"},
                temperature=0.2,
            )
            return _extract_json(resp.choices[0].message.content)

        return self._run(call)

    def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        return self._run(
            lambda client: [
                item.embedding for item in client.embeddings.create(model=self.embed_model, inputs=texts).data
            ]
        )


class OpenAIProvider(LLMProvider):
    name = "openai"

    def __init__(self) -> None:
        if not settings.openai_api_key:
            raise HTTPException(status_code=400, detail="OPENAI_API_KEY is not configured")
        from openai import OpenAI

        self.model = settings.openai_model
        self.embed_model = settings.openai_embed_model
        self._client = OpenAI(api_key=settings.openai_api_key)

    def complete_json(self, system_prompt: str, user_prompt: str) -> dict:
        # gpt-5-mini only supports default temperature; omit it.
        resp = self._client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
        )
        return _extract_json(resp.choices[0].message.content)

    def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        resp = self._client.embeddings.create(model=self.embed_model, input=texts)
        return [item.embedding for item in resp.data]


def get_provider(name: str | None) -> LLMProvider:
    name = (name or settings.default_llm_provider).lower()
    if name == "mistral":
        return MistralProvider()
    if name == "openai":
        return OpenAIProvider()
    raise HTTPException(status_code=400, detail=f"Unknown LLM provider: {name}")
