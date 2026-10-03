# POST /chat — multi-turn refinement of an existing meal plan.
#
# Each call rebuilds the system prompt from the, fixed nutritionist persona + current profile (TBD - not updated in this call yet) + current_plan,
# and re-sends conversation history (user texts + short assistant notes).
# We always return a full plan (never a diff) because partial updates are harder to validate and to render.
# Session/UI only — does not write active_plan. Logged-in users persist via POST /plan/save.

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, ValidationError

from agent.llm import LLM, Message
from agent.prompts import build_assistant_note, build_edit_system_prompt
from agent.schemas import Meal, MealPlan
from agent.session import SessionStore
from agent.users import UserStore
from src.app.dependencies import get_llm, get_session_store, get_user_store
from src.app.routes.auth import personal_foods_for_request


router = APIRouter()


# The JSON shape the frontend sends to /chat.
class ChatRequest(BaseModel):
    session_id: str
    # `min_length=1` blocks empty strings; `max_length=1000` caps payload
    # size. Both enforced by Pydantic before our handler even runs.
    message: str = Field(min_length=1, max_length=1000)


# The JSON shape /chat returns — just the updated plan (the frontend already
# has the session_id from /plan).
class ChatResponse(BaseModel):
    plan: MealPlan


def _lock_eaten_meals(sent: MealPlan, reply: MealPlan) -> MealPlan:
    """Copy eaten meals from the plan sent into the prompt back onto the reply.

    Same index when the reply is long enough. If the reply is shorter and an
    eaten meal no longer fits, append it, still eaten. The model's own eaten
    flag is ignored: chat cannot check or uncheck a meal.
    """
    locked: list[Meal] = []
    for index, reply_meal in enumerate(reply.meals):
        if index < len(sent.meals) and sent.meals[index].eaten:
            locked.append(sent.meals[index].model_copy(update={"eaten": True}))
        else:
            locked.append(reply_meal.model_copy(update={"eaten": False}))
    for index in range(len(reply.meals), len(sent.meals)):
        sent_meal = sent.meals[index]
        if sent_meal.eaten:
            locked.append(sent_meal.model_copy(update={"eaten": True}))
    return reply.model_copy(update={"meals": locked})


# Handler for POST /chat. Called by FastAPI whenever the user types a
# refinement after having already called /plan at least once.
#
# Flow, in order:
#   1. Body is parsed into ChatRequest (Pydantic enforces 1..1000 chars).
#   2. FastAPI injects `llm` and `store` via Depends(...).
#   3. We LOAD the session by id. If missing -> 404 (user never called /plan).
#   4. We build the conversation: session.history + [new user turn].
#   5. We call llm.chat(...) with persona + profile + current_plan in system.
#   6. We re-validate the reply into a MealPlan; 502 if malformed.
#   7. We copy eaten meals from the sent plan back onto the reply, then
#      replace current_plan and append user turn + short note to history.
#   8. We return { plan } — no DB write (see POST /plan/save).
@router.post("/chat", response_model=ChatResponse)
def chat(
    request: ChatRequest,
    http_request: Request,
    llm: LLM = Depends(get_llm),
    store: SessionStore = Depends(get_session_store),
    user_store: UserStore = Depends(get_user_store),
) -> ChatResponse:
    session = store.get(request.session_id)
    # `is None` — use `is` (identity) for None checks, not `== None`. Faster,
    # and safer against weird classes that override `__eq__`.
    if session is None:
        raise HTTPException(status_code=404, detail="Unknown session_id. Call /plan first.")
    if session.current_plan is None:
        raise HTTPException(
            status_code=400,
            detail="No meal plan to edit. Call /plan first.",
        )

    user_turn = Message(role="user", content=request.message)
    # `list + list` returns a NEW list — `session.history` isn't mutated here.
    # We only append to history below, AFTER the LLM reply validates cleanly.
    conversation = session.history + [user_turn]

    # Keep the plan that went into the prompt so eaten meals can be copied back.
    sent_plan = session.current_plan

    # Edit path: profile constraints, this user's library (if any), then the plan.
    # The library is read now, not from the session, so a food just saved is visible.
    personal_foods = personal_foods_for_request(http_request, user_store)
    raw_reply = llm.chat(
        messages=conversation,
        system=build_edit_system_prompt(
            session.profile, sent_plan, personal_foods
        ),
        response_schema=MealPlan,
    )

    try:
        reply_plan = MealPlan.model_validate_json(raw_reply)
    except ValidationError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"LLM returned an invalid MealPlan: {exc}",
        ) from exc

    # Eaten meals stay as they were sent. Every other meal keeps the reply.
    plan = _lock_eaten_meals(sent_plan, reply_plan)
    session.current_plan = plan
    # Append the new user turn and the new assistant note to the history. History stays cheap: full user text + short assistant note.
    session.history.append(user_turn)
    session.history.append(Message(role="model", content=build_assistant_note(plan)))
    # Must write back — sessions live in Supabase, not process memory.
    store.save(request.session_id, session)

    return ChatResponse(plan=plan)
