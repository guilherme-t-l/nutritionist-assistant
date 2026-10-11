# The ONLY file in the codebase that talks to an LLM.
#
# If we ever swap Gemini for OpenAI, Claude, or a local model, this is the
# only file that changes. Everyone else imports `LLM` (the interface) and
# `Message` (the shape of a conversation turn) from here.
#
# Teaching note: `Protocol` (structural typing) lets us define an interface
# *by shape*. Any class with a matching `chat` method counts as an `LLM` —
# no inheritance required. That's what lets `FakeLLM` in the tests stand in
# for `GeminiLLM` in production without any glue code.

# `from __future__ import annotations` makes all type hints in this file
# lazy strings — so forward references and modern syntax work everywhere.
from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from typing import Literal, Protocol

import httpx
from google import genai
from google.genai import types
from google.genai.errors import APIError
from pydantic import BaseModel


# `Literal[...]` pins the type to these exact string values — anything else
# is a type error. Narrower than `str`, safer than a plain enum for two values.
Role = Literal["user", "model"]


# One turn of a conversation (either from the user or from the model).
# `@dataclass` auto-generates __init__, __repr__, __eq__ from the fields
# below, saving us from writing `def __init__(self, role, content): ...`.
@dataclass
class Message:
    role: Role
    content: str


# Gemini refused or could not answer (quota, overload, empty body, other API
# error). Routes do not catch this themselves — the app turns it into JSON
# `{"detail": ...}` so the page can show the sentence instead of crashing
# on the plain-text "Internal Server Error" body.
class LLMUnavailable(Exception):
    def __init__(self, status_code: int, detail: str) -> None:
        self.status_code = status_code
        self.detail = detail
        super().__init__(detail)


def _gemini_failure_detail(exc: APIError) -> tuple[int, str]:
    """Turn a Gemini HTTP error into a status code plus one readable sentence.

    The code stays in the sentence so a tester can tell quota (429) from
    overload (503) without opening the server log. Google's own message is
    kept only for other codes, and only the first line — the 429 body is a
    long quota dump that is useless in the chat box.
    """
    code = exc.code if isinstance(exc.code, int) else 502
    status = exc.status or "ERROR"
    http_status = code if 400 <= code <= 599 else 502

    if code == 429:
        return http_status, (
            f"Gemini quota exceeded ({code} {status}). "
            "This project's request limit is used up. Try again later."
        )
    if code == 503:
        return http_status, (
            f"Gemini is busy ({code} {status}). "
            "The model is under high demand. Try again in a moment."
        )
    if code == 504:
        return http_status, "Gemini took too long (504). Try again in a moment."
    if code == 500:
        return http_status, "Gemini had an internal error (500). Try again in a moment."
    if code in (401, 403, 404):
        return http_status, (
            f"Couldn't reach Gemini ({code}). "
            "The API key or model name needs a fix — see the server log."
        )
    if code == 400:
        return http_status, (
            "Gemini rejected the request (400). "
            "Try again. If it keeps happening, see the server log."
        )

    message = (exc.message or "The model request failed.").strip().split("\n", 1)[0]
    if len(message) > 240:
        message = message[:240].rstrip() + "…"
    return http_status, f"Gemini request failed ({code} {status}). {message}"


# The "interface" every LLM implementation must satisfy.
# `Protocol` = structural typing: any class with a `chat` method matching the
# signature below IS-A LLM, even without inheriting this class. That's how
# FakeLLM (in tests) can stand in for GeminiLLM (in production) transparently.
class LLM(Protocol):
    # The one method every LLM exposes. Called by /plan and /chat via
    # `llm.chat(messages=..., system=..., response_schema=MealPlan)`.
    # `response_schema` constrains the reply to valid JSON for that Pydantic
    # model — the returned string is guaranteed parseable into it.
    def chat(
        self,
        messages: list[Message],
        # The bare `*` forces every argument after it to be keyword-only,
        # so callers MUST write `system=...` and `response_schema=...`.
        *,
        system: str,
        response_schema: type[BaseModel],
    ) -> str:
        ...


# Real implementation that calls Google's Gemini API over HTTPS.
class GeminiLLM:
    # gemini-2.5-flash is the fast, cheap, free-tier model.
    # Upgrade to gemini-2.5-pro for harder reasoning if ever needed.
    DEFAULT_MODEL = "gemini-3.5-flash"

    # Called once, from the get_llm() factory below, the first time anyone
    # needs an LLM in the process. Stores the SDK client so subsequent calls
    # reuse the same HTTP connection pool.
    def __init__(self, api_key: str, model: str = DEFAULT_MODEL) -> None:
        # Leading underscore on `_client` / `_model` is a Python convention
        # for "treat as private" — nothing enforces it, but other code
        # shouldn't touch these directly.
        self._client = genai.Client(api_key=api_key)
        self._model = model

    # The actual network call to Gemini. Called from /plan and /chat via
    # the `llm.chat(...)` line in each route handler.
    #
    # Steps:
    #   1. Translate our Message objects into Gemini's native Content shape.
    #   2. Call generate_content(...) — this is the slow part (seconds,
    #      HTTPS round-trip to Google).
    #   3. Pass `response_schema` so the SDK forces Gemini's output to be
    #      JSON matching that Pydantic model (the ONLY reliable way to get
    #      structured output; without it we'd be prompt-engineering and
    #      praying).
    #   4. Return the raw JSON string — the caller re-validates with Pydantic.
    def chat(
        self,
        messages: list[Message],
        *,
        system: str,
        response_schema: type[BaseModel],
    ) -> str:
        # List comprehension — reads as "for every m in messages, build a
        # Content object". Equivalent to a for-loop with `.append()`, but
        # one expression instead of three lines.
        contents = [
            types.Content(role=m.role, parts=[types.Part(text=m.content)])
            for m in messages
        ]

        try:
            response = self._client.models.generate_content(
                model=self._model,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=system,
                    # Forces the model to reply with JSON matching the Pydantic
                    # schema. Without this we'd have to prompt-engineer the JSON
                    # format and hope — with it, Gemini is constrained by the SDK.
                    response_mime_type="application/json",
                    response_schema=response_schema,
                ),
            )
        except APIError as exc:
            # `raise ... from exc` keeps Google's original error as the cause,
            # so the server log still has the full quota or overload body.
            status_code, detail = _gemini_failure_detail(exc)
            raise LLMUnavailable(status_code, detail) from exc
        except (httpx.HTTPError, TimeoutError, ConnectionError) as exc:
            raise LLMUnavailable(
                503,
                "Couldn't reach Gemini. Check your connection and try again.",
            ) from exc

        if not response.text:
            raise LLMUnavailable(502, "Gemini returned an empty response. Try again.")

        # Dev-only: dump input + history + answer after the network call.
        # Off by default so normal runs (and FakeLLM tests) stay quiet.
        if os.environ.get("PROMPT_INSPECTOR") == "1":
            from agent.prompt_inspector import dump_llm_input

            dump_llm_input(system, messages, response.text)

        return response.text


# Factory for the production LLM. Called (indirectly, via
# src/app/dependencies.py:get_llm) on the first request that needs an LLM,
# then cached for the life of the process.
#
# `@lru_cache(maxsize=1)` turns this into a 1-slot cache: the first call runs
# the body, every later call returns the same object. Poor-man's singleton —
# one shared HTTP client across every request, no global variable needed.
#
# Lazy on purpose: tests (which use a FakeLLM) never trigger this, so they
# never require a real GEMINI_API_KEY.
@lru_cache(maxsize=1)
def get_llm() -> LLM:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key or api_key == "your-key-here":
        # Raised and immediately chained so the log names the missing key,
        # while the page only gets the short sentence.
        try:
            raise RuntimeError(
                "GEMINI_API_KEY is not set. Put a real key in .env — "
                "get one free at https://aistudio.google.com/apikey"
            )
        except RuntimeError as exc:
            raise LLMUnavailable(
                401,
                "Couldn't reach Gemini (401). "
                "The API key or model name needs a fix — see the server log.",
            ) from exc
    return GeminiLLM(api_key=api_key)
