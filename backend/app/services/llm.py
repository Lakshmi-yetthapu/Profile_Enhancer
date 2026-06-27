"""Provider-agnostic LLM client. Supports Mistral and OpenAI, selectable per request.

Each provider is asked to return a single JSON object. We parse and return a dict.
"""

from __future__ import annotations

import json
from abc import ABC, abstractmethod

from fastapi import HTTPException

from app.config import settings


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
        if not settings.mistral_api_key:
            raise HTTPException(status_code=400, detail="MISTRAL_API_KEY is not configured")
        from mistralai import Mistral

        self.model = settings.mistral_model
        self.embed_model = settings.mistral_embed_model
        self._client = Mistral(api_key=settings.mistral_api_key)

    def complete_json(self, system_prompt: str, user_prompt: str) -> dict:
        resp = self._client.chat.complete(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
        )
        return _extract_json(resp.choices[0].message.content)

    def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        resp = self._client.embeddings.create(model=self.embed_model, inputs=texts)
        return [item.embedding for item in resp.data]


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
