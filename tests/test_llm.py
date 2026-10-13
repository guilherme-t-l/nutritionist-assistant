"""Gemini HTTP failures become one short sentence the UI can show."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from google.genai.errors import ClientError, ServerError

from agent.llm import GeminiLLM, LLMUnavailable, Message
from agent.schemas import MealPlan


def _gemini_raising(exc: Exception) -> GeminiLLM:
    llm = GeminiLLM.__new__(GeminiLLM)
    llm._model = "test-model"
    llm._client = MagicMock()
    llm._client.models.generate_content.side_effect = exc
    return llm


def _chat(llm: GeminiLLM) -> None:
    # `types` is only used to build the request. Patching it skips the real
    # SDK objects so the test can focus on the error that comes back.
    with patch("agent.llm.types"):
        llm.chat(
            [Message(role="user", content="swap dinner")],
            system="persona",
            response_schema=MealPlan,
        )


def test_overload_becomes_a_short_busy_message() -> None:
    exc = ServerError(
        503,
        {
            "error": {
                "code": 503,
                "message": "This model is currently experiencing high demand.",
                "status": "UNAVAILABLE",
            }
        },
    )
    with pytest.raises(LLMUnavailable) as caught:
        _chat(_gemini_raising(exc))

    err = caught.value
    assert err.status_code == 503
    assert err.detail == (
        "Gemini is busy (503 UNAVAILABLE). "
        "The model is under high demand. Try again in a moment."
    )
    # The original Google error stays attached for the server log.
    assert err.__cause__ is exc


def test_quota_message_stays_short() -> None:
    exc = ClientError(
        429,
        {
            "error": {
                "code": 429,
                "message": "You exceeded your current quota.\n" + ("x" * 500),
                "status": "RESOURCE_EXHAUSTED",
            }
        },
    )
    with pytest.raises(LLMUnavailable) as caught:
        _chat(_gemini_raising(exc))

    err = caught.value
    assert err.status_code == 429
    assert err.detail == (
        "Gemini quota exceeded (429 RESOURCE_EXHAUSTED). "
        "This project's request limit is used up. Try again later."
    )
    assert "xxxxx" not in err.detail


def test_rejected_request_hides_googles_essay() -> None:
    exc = ClientError(
        400,
        {
            "error": {
                "code": 400,
                "message": "bad schema\nignore this second line",
                "status": "INVALID_ARGUMENT",
            }
        },
    )
    with pytest.raises(LLMUnavailable) as caught:
        _chat(_gemini_raising(exc))

    assert caught.value.status_code == 400
    assert caught.value.detail == (
        "Gemini rejected the request (400). "
        "Try again. If it keeps happening, see the server log."
    )
    assert "bad schema" not in caught.value.detail
    assert caught.value.__cause__ is exc


def test_other_api_error_keeps_the_first_line_only() -> None:
    exc = ClientError(
        418,
        {
            "error": {
                "code": 418,
                "message": "bad schema\nignore this second line",
                "status": "INVALID_ARGUMENT",
            }
        },
    )
    with pytest.raises(LLMUnavailable) as caught:
        _chat(_gemini_raising(exc))

    assert caught.value.status_code == 418
    assert caught.value.detail == (
        "Gemini request failed (418 INVALID_ARGUMENT). bad schema"
    )


def test_deadline_and_internal_errors_are_short() -> None:
    deadline = ServerError(
        504,
        {"error": {"code": 504, "message": "deadline\n" + "x" * 400, "status": "DEADLINE_EXCEEDED"}},
    )
    with pytest.raises(LLMUnavailable) as caught:
        _chat(_gemini_raising(deadline))
    assert caught.value.detail == "Gemini took too long (504). Try again in a moment."
    assert "xxxx" not in caught.value.detail

    internal = ServerError(
        500,
        {"error": {"code": 500, "message": "backend boom", "status": "INTERNAL"}},
    )
    with pytest.raises(LLMUnavailable) as internal_caught:
        _chat(_gemini_raising(internal))
    assert internal_caught.value.detail == (
        "Gemini had an internal error (500). Try again in a moment."
    )


def test_auth_failure_points_at_the_key_without_the_dump() -> None:
    exc = ClientError(
        401,
        {"error": {"code": 401, "message": "API key not valid", "status": "UNAUTHENTICATED"}},
    )
    with pytest.raises(LLMUnavailable) as caught:
        _chat(_gemini_raising(exc))
    assert caught.value.status_code == 401
    assert caught.value.detail == (
        "Couldn't reach Gemini (401). "
        "The API key or model name needs a fix — see the server log."
    )
    assert "API key not valid" not in caught.value.detail


def test_connection_error_is_a_reachability_message() -> None:
    import httpx

    with pytest.raises(LLMUnavailable) as caught:
        _chat(_gemini_raising(httpx.ConnectError("connection refused")))
    assert caught.value.status_code == 503
    assert caught.value.detail == (
        "Couldn't reach Gemini. Check your connection and try again."
    )


def test_empty_response_is_a_clear_error() -> None:
    llm = GeminiLLM.__new__(GeminiLLM)
    llm._model = "test-model"
    llm._client = MagicMock()
    llm._client.models.generate_content.return_value = MagicMock(text="")

    with pytest.raises(LLMUnavailable) as caught:
        _chat(llm)

    assert caught.value.status_code == 502
    assert caught.value.detail == "Gemini returned an empty response. Try again."
