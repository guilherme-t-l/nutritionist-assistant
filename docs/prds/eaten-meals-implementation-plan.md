# Eaten meals — implementation plan

PRD: `docs/prds/eaten-meals.md` (Approved). Open questions: none.

The feature already matches this PRD. The implementer should not change behavior.

Signed-in decision, already in `POST /plan/eaten`: that request writes only that meal's `eaten` flag onto `active_plan` at the same index. It does not save unsaved chat food edits. Discard restores the saved plan, so the check stays and unsaved coach edits are thrown away. Guests have only the session. `POST /chat` still does not write `active_plan`. Save plan still saves the working plan.

Revised chat decision, already in `_lock_eaten_meals`: trust the coach's JSON. If the reply omits an uneaten meal, that meal is gone. The server does not invent it. That is allowed even when the prompt asks the model to include every uneaten meal. An eaten meal is still copied back at the same index, still eaten, or appended if the reply is too short. Chat cannot unlock it. Other meals in the reply keep the reply's foods with `eaten` false. The model's own `eaten` flag is ignored.

## Files to change

None. These already match. Do not edit them to add a restore of omitted uneaten meals.

- `agent/schemas.py` — `Meal.eaten: bool = False`. Old JSON with no `eaten` key parses as not eaten. `MealPlan` is still one list.
- `agent/prompts.py` — `_edit_job_instructions` already says an eaten meal was already eaten, copy it exactly, do not rewrite, remove, or redistribute it, and fit the other meals around those calories and macros. It asks the model to include every meal that is not eaten, and to remove a meal only when the user skipped a meal that is not eaten. That sentence is a prompt request. It is not a server restore. `build_edit_system_prompt` is still four pieces and one `plan.model_dump_json()`.
- `src/app/routes/chat.py` — `_lock_eaten_meals` walks the reply. An eaten sent meal at that index is copied back, still eaten. Each other reply meal keeps the reply's foods with `eaten` false. After the reply ends, only eaten sent meals whose index no longer fits are appended. An uneaten meal the reply left out is not appended. `POST /chat` does not call `user_store`.
- `src/app/routes/plan.py` — `POST /plan/eaten` updates the session and, for a signed-in user, only that flag on `active_plan` when the index exists there. `_store_unchecked` forces `eaten` false on `POST /plan` and `POST /plan/import`. Save and Discard are unchanged.
- `src/app/templates/onboarding.html` — `renderMeal` puts one circle on the meal head. A click posts `/plan/eaten` and re-renders `{ plan }` without a Coach Chat line, without "Updating your plan", and without `markPlanDirty` or `markPlanClean`.
- `README.md` — The short Today's menu note is already under "Run the server". The endpoints table is unchanged.
- `tests/test_schemas.py`, `tests/test_prompts.py`, `tests/test_persistence.py` — Already cover a missing `eaten` key, the four prompt pieces, and the signed-in flag-only write plus discard.
- `tests/test_chat.py` — Already covers a rewritten or unlocked eaten meal, create and import storing `eaten` false, and a short reply. `test_chat_appends_an_eaten_meal_when_the_reply_is_too_short` checks meal 2 (eaten) is appended and that the omitted unchecked meal, Feijoada lite, is absent. Do not add a second test that restores that meal, and do not change this one so that it expects the server to invent it.

## Approach

Leave the code as it is. The prompt may ask for every uneaten meal. The lock does not enforce that ask. It only puts eaten meals back, by index or by append when the reply is too short, and it stores every other reply meal with `eaten` false.

`test_chat_appends_an_eaten_meal_when_the_reply_is_too_short` is the assertion that an omitted unchecked meal stays absent. No new test and no new lock.

QA uses the server that is already running. `GeminiLLM.DEFAULT_MODEL` in `agent/llm.py` is already `gemini-3.5-flash`. Do not change the model.

## Test command

`uv run pytest`

## Localhost

Start: `uv run uvicorn src.app.main:app --reload`, then `http://localhost:8000/`. Checks 2–4 use a second start: `PROMPT_INSPECTOR=1 uv run uvicorn src.app.main:app --reload`. Use that running server as it is. Do not change `GeminiLLM.DEFAULT_MODEL`.

1. Check and uncheck a meal. Open `http://localhost:8000/` → Continue as Guest → Save & Build New Plan, so Today's menu is on screen. Click one meal's empty circle, then click it again. It fills with a check and that meal looks quieter. No new Coach Chat line, and "Updating your plan" does not show. The second click clears the circle and the meal looks like the others. Ingredient rows have no circle.

2. The agent plans the rest of the day around an eaten meal. Start the server with `PROMPT_INSPECTOR=1`, then `http://localhost:8000/` → Continue as Guest → Save & Build New Plan. Today's menu has at least two meals. The page does not show the system prompt. Check one meal. Note its name, description, ingredient names and quantities, and meal total, and note the same for each unchecked meal. In Coach Chat, say you already ate the checked meal and ask the coach to rebalance the rest of the day around those calories and macros without changing it. After the reply, read the server terminal. On the page, the checked meal still matches the notes and is still checked. The page does not show the system prompt. In the terminal, the `PROMPT INSPECTOR` dump's system text has the already-eaten instructions and one plan JSON, with `eaten` true on the checked meal and `eaten` false on the other meals that were on the plan sent into the prompt. That dump is not on the page. The dump's answer is the model's raw reply; the card is the plan after the index lock. If the reply includes the other meals, they no longer match the notes (name, foods, quantities, or meal total) and their circles are empty. If the reply omits an unchecked meal, that meal is absent from the card. This check does not require the model to always return the unchecked meals. A server started without `PROMPT_INSPECTOR=1` does not print `PROMPT INSPECTOR`.

3. Asking to change or skip a checked meal does not unlock it. The same server as check 2 (`PROMPT_INSPECTOR=1`). Today's menu with one meal checked. Note that meal and the unchecked meals, as in check 2. Ask the coach to change that checked meal and rebalance the others. After the card updates, read the terminal, then say you skipped that same meal and to remove it and spread its calories across the day. Read the terminal again. After each reply the page still shows that meal matching the original notes, still checked, not removed. Asking to change it or to skip it does not unlock it or remove it. Unchecked meals follow the reply, including being absent from the card if the reply omitted them. If the reply includes an unchecked meal, the card shows that reply's foods and an empty circle. The chat did not clear the check. Each dump's system text still has the already-eaten instructions and one plan JSON with `eaten` true on that meal and `eaten` false on the others that were sent in. The page does not show the prompt.

4. Clearing the circle lets the agent edit that meal. The same server as check 2. The same plan, that meal still checked, notes from check 3. Clear the circle. Ask the coach to change that meal. Read the terminal after the reply. On the page, that meal's name, description, ingredients, quantities, or meal total differs from the notes, and its circle is empty. The dump's one plan JSON has `eaten` false on that meal. The page does not show the prompt.

5. A new plan and an imported plan start unchecked. Open `http://localhost:8000/` → Continue as Guest → Save & Build New Plan. Look at every circle. Click New plan, then Save & Upload Existing Plan. Paste a short plan with two meals. Click Use this plan. After the built plan, and again after Use this plan, every meal has an empty circle and normal emphasis.

6. An old saved plan with no eaten field shows meals unchecked. Open `http://localhost:8000/` → Log In as an account whose saved plan was stored before this field (meals have no `eaten`). Today's menu shows an empty circle on every meal, with normal emphasis.

7. Food behavior without a live model. Open `tests/test_prompts.py` and `tests/test_chat.py`. Not the page. Run `uv run pytest tests/test_prompts.py tests/test_chat.py`. They do not call Gemini. The edit prompt is still four pieces, includes the eaten-meal sentences, and puts `eaten` true inside the single plan JSON. The skipped-meal sentence remains, only for meals that are not eaten. A fake chat reply that rewrites a checked meal, drops it, or sets `eaten` false still returns that meal unchanged and still eaten, at the same index, or appended when the reply is too short for that index. An unchecked meal keeps the reply's foods with `eaten` false. If that reply omits an unchecked meal, the meal is absent and the server does not invent it. A reply cannot set `eaten` true on a meal the user did not check. Create and import store `eaten` false. This holds with the inspector off.

## Not building

- A lock that restores an uneaten meal the reply omitted. The prompt may ask for that meal. The server still does not invent it.
- A new test whose expected plan puts that omitted unchecked meal back.
- A change to `GeminiLLM.DEFAULT_MODEL`. QA uses the running server, which already uses `gemini-3.5-flash`.
- A weekly tracker, a calendar, eaten-at timestamps, or a history of what was eaten.
- A circle or check per ingredient or per food.
- A second list on `MealPlan`, or any new prompt section. `build_edit_system_prompt` stays four pieces and one plan JSON.
- A prompt panel, route, or page. Production leaves `PROMPT_INSPECTOR` unset.
- Calorie-target tolerance, personal foods, or import-as-is nutrition, beyond forcing new and imported meals to start unchecked.
- A new `UserStore` method, or a new agent module that splits or merges plans.
- Writing `active_plan` from `POST /chat`, or changing Save plan or Discard.
- `markPlanDirty` on a check.
- A database migration, a new dependency, or a new doc besides the README note already there.
