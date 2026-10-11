"""End-to-end tests for POST /chat.

The point of these tests: prove that on the second turn, the LLM sees
(1) the latest plan in the system prompt, and (2) prior turns as short
notes — not a stack of full MealPlan JSONs in history.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from agent.errors import EXPIRED_SESSION, INVALID_PLAN, UNEXPECTED, StorageError
from agent.llm import LLMUnavailable
from agent.schemas import MealPlan, UserProfile
from tests.conftest import CANNED_PLAN_JSON, FakeLLM, FakeSessionStore, FakeUserStore


def test_chat_uses_session_and_forwards_history(
    client: TestClient, fake_llm: FakeLLM
) -> None:
    plan_response = client.post(
        "/plan",
        json={
            "goal": "maintain",
            "calorie_target": 2000,
            "cuisine_preferences": ["Brazilian"],
        },
    )
    session_id = plan_response.json()["session_id"]

    chat_response = client.post(
        "/chat",
        json={"session_id": session_id, "message": "make lunch lighter"},
    )

    assert chat_response.status_code == 200, chat_response.text

    second_call = fake_llm.calls[1]
    messages = second_call["messages"]
    system = second_call["system"]

    # We should see: initial user message, short model note, new user turn.
    assert len(messages) == 3
    assert messages[0].role == "user"
    assert messages[1].role == "model"
    assert messages[2].role == "user"
    assert messages[2].content == "make lunch lighter"

    # Plan lives in system on Call 2 — not as a full JSON model turn in history.
    assert "Current meal plan:" in system
    assert "Tapioca com queijo" in system
    # Guest chat has no library section.
    assert "Personal foods" not in system
    assert messages[1].content == "Balanced day."
    assert "meals" not in messages[1].content


# After /chat succeeds: current_plan is replaced, and history grows by the
# new user message + another short assistant note.
def test_chat_replaces_current_plan_and_appends_short_note(
    client: TestClient, fake_llm: FakeLLM, session_store: FakeSessionStore
) -> None:
    # Give Call 2 a different notes string so we can tell the plan was replaced.
    plan_response = client.post(
        "/plan",
        json={"goal": "maintain", "calorie_target": 2000},
    )
    session_id = plan_response.json()["session_id"]

    fake_llm.canned_reply = fake_llm.canned_reply.replace(
        '"notes": "Balanced day."',
        '"notes": "Made lunch lighter."',
    )

    chat_response = client.post(
        "/chat",
        json={"session_id": session_id, "message": "make lunch lighter"},
    )
    assert chat_response.status_code == 200, chat_response.text

    session = session_store.get(session_id)
    assert session is not None
    assert session.current_plan is not None
    assert session.current_plan.notes == "Made lunch lighter."

    # user task, first note, refinement, second note
    assert len(session.history) == 4
    assert session.history[2].role == "user"
    assert session.history[2].content == "make lunch lighter"
    assert session.history[3].role == "model"
    assert session.history[3].content == "Made lunch lighter."


def test_chat_rejects_unknown_session(client: TestClient) -> None:
    response = client.post(
        "/chat",
        json={"session_id": "does-not-exist", "message": "hi"},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == EXPIRED_SESSION


def test_chat_rejects_empty_message(client: TestClient) -> None:
    plan_response = client.post(
        "/plan",
        json={"goal": "maintain", "calorie_target": 2000},
    )
    session_id = plan_response.json()["session_id"]

    response = client.post(
        "/chat",
        json={"session_id": session_id, "message": ""},
    )

    assert response.status_code == 422


def test_chat_rejects_a_message_over_1000_characters(client: TestClient) -> None:
    session_id = _new_plan(client)
    response = client.post(
        "/chat",
        json={"session_id": session_id, "message": "a" * 1001},
    )
    assert response.status_code == 422
    assert response.json()["detail"] == (
        "Message is too long. Keep it under 1,000 characters."
    )


def _canned_plan() -> MealPlan:
    return MealPlan.model_validate_json(CANNED_PLAN_JSON)


def _new_plan(client: TestClient) -> str:
    response = client.post(
        "/plan",
        json={"goal": "maintain", "calorie_target": 2000},
    )
    assert response.status_code == 200, response.text
    return response.json()["session_id"]


def _set_eaten(client: TestClient, session_id: str, meal_index: int, eaten: bool) -> dict:
    response = client.post(
        "/plan/eaten",
        json={"session_id": session_id, "meal_index": meal_index, "eaten": eaten},
    )
    assert response.status_code == 200, response.text
    return response.json()["plan"]


def test_chat_keeps_a_rewritten_eaten_meal_and_lets_others_change(
    client: TestClient,
    fake_llm: FakeLLM,
    session_store: FakeSessionStore,
    user_store: FakeUserStore,
) -> None:
    session_id = _new_plan(client)
    calls_after_plan = len(fake_llm.calls)
    plan = _set_eaten(client, session_id, 0, True)
    # A check is not a chat turn and does not call the model.
    assert len(fake_llm.calls) == calls_after_plan
    session = session_store.get(session_id)
    assert session is not None
    assert len(session.history) == 2
    guest = user_store.get_user("demo1")
    assert guest is not None
    assert guest.active_plan is None

    original = plan["meals"][0]
    base = _canned_plan()
    meals = list(base.meals)
    meals[0] = meals[0].model_copy(
        update={
            "name": "Rewritten breakfast",
            "description": "The model changed this.",
            "eaten": False,
            "ingredients": [
                meals[0].ingredients[0].model_copy(
                    update={"name": "oats", "quantity": "40 g"}
                ),
            ],
        }
    )
    meals[1] = meals[1].model_copy(update={"name": "Lighter lunch", "eaten": True})
    meals[2] = meals[2].model_copy(update={"eaten": True})
    fake_llm.canned_reply = base.model_copy(
        update={"meals": meals, "notes": "Rebalanced the open meals."}
    ).model_dump_json()

    chat = client.post(
        "/chat",
        json={"session_id": session_id, "message": "rebalance around breakfast"},
    )
    assert chat.status_code == 200, chat.text
    body = chat.json()["plan"]

    assert body["meals"][0]["name"] == original["name"]
    assert body["meals"][0]["description"] == original["description"]
    assert body["meals"][0]["ingredients"] == original["ingredients"]
    assert body["meals"][0]["eaten"] is True
    assert body["meals"][1]["name"] == "Lighter lunch"
    assert body["meals"][1]["eaten"] is False
    assert body["meals"][2]["name"] == "Grilled fish with farofa"
    assert body["meals"][2]["eaten"] is False
    assert body["notes"] == "Rebalanced the open meals."


def test_chat_appends_an_eaten_meal_when_the_reply_is_too_short(
    client: TestClient, fake_llm: FakeLLM
) -> None:
    session_id = _new_plan(client)
    plan = _set_eaten(client, session_id, 2, True)
    kept = plan["meals"][2]

    base = _canned_plan()
    short = MealPlan(
        meals=[
            base.meals[0].model_copy(update={"name": "Only breakfast", "eaten": True})
        ],
        notes="Dropped the rest.",
    )
    fake_llm.canned_reply = short.model_dump_json()

    chat = client.post(
        "/chat",
        json={"session_id": session_id, "message": "I skipped lunch"},
    )
    assert chat.status_code == 200, chat.text
    meals = chat.json()["plan"]["meals"]

    assert len(meals) == 2
    assert meals[0]["name"] == "Only breakfast"
    assert meals[0]["eaten"] is False
    assert meals[1]["name"] == kept["name"]
    assert meals[1]["description"] == kept["description"]
    assert meals[1]["ingredients"] == kept["ingredients"]
    assert meals[1]["eaten"] is True
    assert all(meal["name"] != "Feijoada lite" for meal in meals)


def test_chat_can_edit_a_meal_after_the_circle_is_cleared(
    client: TestClient, fake_llm: FakeLLM
) -> None:
    session_id = _new_plan(client)
    _set_eaten(client, session_id, 0, True)
    _set_eaten(client, session_id, 0, False)

    base = _canned_plan()
    meals = list(base.meals)
    meals[0] = meals[0].model_copy(
        update={"name": "New breakfast", "eaten": True}
    )
    fake_llm.canned_reply = base.model_copy(update={"meals": meals}).model_dump_json()

    chat = client.post(
        "/chat",
        json={"session_id": session_id, "message": "change breakfast"},
    )
    assert chat.status_code == 200, chat.text
    meal = chat.json()["plan"]["meals"][0]
    assert meal["name"] == "New breakfast"
    assert meal["eaten"] is False


def test_create_and_import_store_eaten_false(
    client: TestClient, fake_llm: FakeLLM
) -> None:
    marked = _canned_plan().model_copy(
        update={
            "meals": [
                meal.model_copy(update={"eaten": True})
                for meal in _canned_plan().meals
            ]
        }
    )
    fake_llm.canned_reply = marked.model_dump_json()

    created = client.post(
        "/plan",
        json={"goal": "maintain", "calorie_target": 2000},
    )
    assert created.status_code == 200, created.text
    assert all(meal["eaten"] is False for meal in created.json()["plan"]["meals"])

    profile = {"goal": "maintain", "calorie_target": 2000}
    imported = client.post(
        "/plan/import",
        json={
            "profile": profile,
            "source_text": marked.model_dump_json(),
            "mode": "as_is",
        },
    )
    assert imported.status_code == 200, imported.text
    assert all(meal["eaten"] is False for meal in imported.json()["plan"]["meals"])
    calls_before_adapt = len(fake_llm.calls)

    adapted = client.post(
        "/plan/import",
        json={
            "profile": profile,
            "source_text": "Breakfast: tapioca. Lunch: rice.",
            "mode": "adapt",
        },
    )
    assert adapted.status_code == 200, adapted.text
    assert len(fake_llm.calls) == calls_before_adapt + 1
    assert all(meal["eaten"] is False for meal in adapted.json()["plan"]["meals"])


def test_plan_eaten_unknown_session_is_404(client: TestClient) -> None:
    response = client.post(
        "/plan/eaten",
        json={"session_id": "does-not-exist", "meal_index": 0, "eaten": True},
    )
    assert response.status_code == 404


def test_plan_eaten_bad_index_or_missing_plan_is_400(
    client: TestClient, session_store: FakeSessionStore
) -> None:
    session_id = _new_plan(client)
    missing = client.post(
        "/plan/eaten",
        json={"session_id": session_id, "meal_index": 9, "eaten": True},
    )
    assert missing.status_code == 400
    negative = client.post(
        "/plan/eaten",
        json={"session_id": session_id, "meal_index": -1, "eaten": True},
    )
    assert negative.status_code == 400

    empty_id, _session = session_store.create(
        UserProfile(goal="maintain", calorie_target=2000)
    )
    no_plan = client.post(
        "/plan/eaten",
        json={"session_id": empty_id, "meal_index": 0, "eaten": True},
    )
    assert no_plan.status_code == 400


def test_chat_returns_json_when_the_model_is_unavailable(
    client: TestClient, fake_llm: FakeLLM, session_store: FakeSessionStore
) -> None:
    """A Gemini failure is JSON the page can show, and the saved plan stays put."""
    session_id = _new_plan(client)
    before = session_store.get(session_id)
    assert before is not None
    assert before.current_plan is not None
    history_len = len(before.history)
    notes = before.current_plan.notes

    fake_llm.error = LLMUnavailable(
        503,
        "Gemini is busy (503 UNAVAILABLE). "
        "The model is under high demand. Try again in a moment.",
    )
    response = client.post(
        "/chat",
        json={
            "session_id": session_id,
            "message": "swap dinner for something lighter",
        },
    )

    assert response.status_code == 503
    assert response.headers["content-type"].startswith("application/json")
    body = response.json()
    assert body["detail"] == (
        "Gemini is busy (503 UNAVAILABLE). "
        "The model is under high demand. Try again in a moment."
    )

    after = session_store.get(session_id)
    assert after is not None
    assert after.current_plan is not None
    assert len(after.history) == history_len
    assert after.current_plan.notes == notes


def test_chat_hides_an_unusable_plan(
    client: TestClient, fake_llm: FakeLLM
) -> None:
    session_id = _new_plan(client)
    fake_llm.canned_reply = "this is not a meal plan"
    response = client.post(
        "/chat",
        json={"session_id": session_id, "message": "swap dinner"},
    )
    assert response.status_code == 502
    assert response.json()["detail"] == INVALID_PLAN
    assert "this is not a meal plan" not in response.text


def test_chat_says_the_reply_was_not_saved(
    client: TestClient, session_store: FakeSessionStore
) -> None:
    session_id = _new_plan(client)
    session_store.save_error = StorageError()
    response = client.post(
        "/chat",
        json={"session_id": session_id, "message": "swap dinner"},
    )
    assert response.status_code == 503
    assert response.json()["detail"] == StorageError.AFTER_COACH
    assert "supabase" not in response.text.lower()


def test_chat_hides_unexpected_errors(
    client: TestClient, fake_llm: FakeLLM
) -> None:
    """The page gets one sentence. The secret stays out of the JSON body.

    A handler for Exception is installed as Starlette's server-error handler,
    which sends the JSON and then re-raises. raise_server_exceptions=False
    lets the test read that JSON instead of seeing the re-raise.
    """
    from src.app.main import app

    session_id = _new_plan(client)
    fake_llm.error = RuntimeError("secret-token-from-the-database")
    quiet = TestClient(app, raise_server_exceptions=False)
    response = quiet.post(
        "/chat",
        json={"session_id": session_id, "message": "swap dinner"},
    )
    assert response.status_code == 500
    assert response.json()["detail"] == UNEXPECTED
    assert "secret-token" not in response.text
