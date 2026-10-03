# Eaten meals

Status: Approved

## Problem

`_edit_job_instructions` tells the coach to edit the current plan, and, if the person skipped a meal, to remove it and redistribute its calories and macros. Nothing says a meal was already eaten, so that meal must stay and the other meals must fit around it. A prompt line alone is not a lock: the model can rewrite the meal or drop the flag, and the next chat treats it as editable again.

## User

Someone with today's plan on screen who has already eaten one or more meals and wants the coach to leave those meals as they were and plan the rest of the day around them.

## Success signal

The agent treats each checked meal as already eaten and fixed. It does not rewrite, remove, or redistribute that meal. It builds the rest of the day — the unchecked meals — around the calories and macros already eaten. If the reply omits an uneaten meal, that meal is gone; the server does not put it back. Clearing the circle is what makes that meal editable by the agent again. The prompt the agent reads is still one plan JSON after the edit instructions, with `eaten` on each meal.

## In scope

- One ordered list, as today. Add `eaten: bool` on `Meal` in `agent/schemas.py`, default false. Do not split `MealPlan` into two lists. Old `active_plan_json` and `current_plan_json` with no `eaten` key still parse, as not eaten. No database migration. A missing `eaten` on the page renders as an empty circle.
- Circle on each meal in Today's menu (`renderMeal` on the meal, not on each ingredient). Empty when not eaten; filled check and quieter meal when eaten. Clicking again clears it. Whole meal only.
- `POST /plan/eaten` with `{ session_id, meal_index, eaten }`. `meal_index` is the 0-based index in `session.current_plan.meals`. Sets that flag on the session plan only for the chosen meal, saves the session, returns `{ plan }`. No Gemini call, no chat history. Unknown session is 404; no plan or a bad index is 400. The card updates without a Coach Chat line and without "Updating your plan". Guests have only the session. For a signed-in user, that same request also writes only that meal's eaten flag onto the saved plan (`active_plan`) immediately, at the same meal index. It does not replace the saved plan with the working plan, so unsaved chat edits to foods are not saved by the check.
- Prompt composition stays the four pieces already concatenated in `build_edit_system_prompt`: shared context, the personal-foods section, `_edit_job_instructions(...)`, then one `plan.model_dump_json()`. The only edit is a few sentences inside `_edit_job_instructions`: a meal with `eaten` true was already eaten; copy it exactly; do not rewrite, remove, or redistribute it; fit the other meals around the calories and macros the eaten meals already use; the existing skipped-meal sentence applies only to meals that are not eaten. `eaten` shows up inside that one JSON blob because it is a field on `Meal`. No second JSON block, no second response schema, and no helper that splits the plan into two prompt sections.
- Server lock on `POST /chat`, after the reply validates and before it replaces `session.current_plan`. Trust the coach's JSON. An eaten meal is copied back onto the reply at the same index, still eaten, or appended if the reply is too short for that index. Chat cannot unlock it. Every other meal keeps the reply's foods and is stored with `eaten` false. The model's own `eaten` flag is ignored. If the reply omits an uneaten meal, that meal is gone. The server does not invent it. That is allowed, even when the prompt asked the model to include every uneaten meal. The prompt already asks the model not to leave an uneaten meal out unless the user skipped it. Only `POST /plan/eaten` with `eaten` false can clear a check.
- `POST /chat` still does not write `active_plan`. Save plan still saves the working plan as it does today. Discard still restores the saved plan. Because the check was written onto the saved plan, Discard keeps the check and throws away unsaved coach edits.
- `POST /plan` and `POST /plan/import` (Use this plan and Edit this plan) store every meal with `eaten` false, even if the model emits true. The card shows empty circles.
- The prompt is printed only in the server terminal, and only for validation. `GeminiLLM.chat` in `agent/llm.py` calls `dump_llm_input` in `agent/prompt_inspector.py` when `PROMPT_INSPECTOR` is exactly `1`. The dump is a `PROMPT INSPECTOR` banner, the system prompt, the user message, history, and the raw answer. Off by default. The page never shows it. Do not add a prompt panel, route, or page. `tests/test_prompt_inspector.py` already asserts that flag.
- Meal behavior is tested with no live model. `tests/test_prompts.py` checks the edit prompt is still the same four pieces, contains the new eaten-meal sentences, puts a meal with `eaten` true in the single plan JSON, and still has the skipped-meal sentence limited to meals that are not eaten. `tests/test_chat.py` uses a fake LLM on `POST /chat`: a reply that rewrites a checked meal, drops it, or sets `eaten` false still returns that meal unchanged and still eaten, at the same index, or appended if the reply is shorter and the index no longer fits. An unchecked meal keeps the reply's foods and is stored with `eaten` false. If the reply omits an unchecked meal, that meal is absent; the server does not invent it. A reply cannot mark a meal eaten that the user did not check. Create and import store `eaten` false.

## Out of scope

- A weekly tracker, a calendar, eaten-at timestamps, or a history of what was eaten.
- A circle or check per ingredient or per food.
- A second list on `MealPlan`, or any new prompt section. `build_edit_system_prompt` stays four pieces and one plan JSON.
- A prompt panel, route, or page. Production leaves `PROMPT_INSPECTOR` unset, so the terminal does not print `PROMPT INSPECTOR`.
- Calorie-target tolerance, personal foods, or import-as-is nutrition, beyond forcing new and imported meals to start unchecked.

## Acceptance checks

1. Check and uncheck a meal
   - Open: `http://localhost:8000/` → Continue as Guest → Save & Build New Plan, so Today's menu is on screen.
   - Do: Click one meal's empty circle, then click it again.
   - Expect: It fills with a check and that meal looks quieter. No new Coach Chat line, and "Updating your plan" does not show. The second click clears the circle and the meal looks like the others. Ingredient rows have no circle.

2. The agent plans the rest of the day around an eaten meal
   - Open: Start the server with `PROMPT_INSPECTOR=1`, then `http://localhost:8000/` → Continue as Guest → Save & Build New Plan. Today's menu has at least two meals. The page does not show the system prompt.
   - Do: Check one meal. Note its name, description, ingredient names and quantities, and meal total, and note the same for each unchecked meal. In Coach Chat, say you already ate the checked meal and ask the coach to rebalance the rest of the day around those calories and macros without changing it. After the reply, read the server terminal.
   - Expect: On the page, the checked meal still matches the notes and is still checked. The page does not show the system prompt. In the terminal, the `PROMPT INSPECTOR` dump's system text has the already-eaten instructions and one plan JSON, with `eaten` true on the checked meal and `eaten` false on the other meals that were on the plan sent into the prompt. That dump is not on the page. The dump's answer is the model's raw reply; the card is the plan after the index lock. If the reply includes the other meals, they no longer match the notes (name, foods, quantities, or meal total) and their circles are empty. If the reply omits an unchecked meal, that meal is absent from the card. This check does not require the model to always return the unchecked meals. A server started without `PROMPT_INSPECTOR=1` does not print `PROMPT INSPECTOR`.

3. Asking to change or skip a checked meal does not unlock it
   - Open: The same server as check 2 (`PROMPT_INSPECTOR=1`). Today's menu with one meal checked. Note that meal and the unchecked meals, as in check 2.
   - Do: Ask the coach to change that checked meal and rebalance the others. After the card updates, read the terminal, then say you skipped that same meal and to remove it and spread its calories across the day. Read the terminal again.
   - Expect: After each reply the page still shows that meal matching the original notes, still checked, not removed. Asking to change it or to skip it does not unlock it or remove it. Unchecked meals follow the reply, including being absent from the card if the reply omitted them. If the reply includes an unchecked meal, the card shows that reply's foods and an empty circle. The chat did not clear the check. Each dump's system text still has the already-eaten instructions and one plan JSON with `eaten` true on that meal and `eaten` false on the others that were sent in. The page does not show the prompt.

4. Clearing the circle lets the agent edit that meal
   - Open: The same server as check 2. The same plan, that meal still checked, notes from check 3.
   - Do: Clear the circle. Ask the coach to change that meal. Read the terminal after the reply.
   - Expect: On the page, that meal's name, description, ingredients, quantities, or meal total differs from the notes, and its circle is empty. The dump's one plan JSON has `eaten` false on that meal. The page does not show the prompt.

5. A new plan and an imported plan start unchecked
   - Open: `http://localhost:8000/` → Continue as Guest → Save & Build New Plan.
   - Do: Look at every circle. Click New plan, then Save & Upload Existing Plan. Paste a short plan with two meals. Click Use this plan.
   - Expect: After the built plan, and again after Use this plan, every meal has an empty circle and normal emphasis.

6. An old saved plan with no eaten field shows meals unchecked
   - Open: `http://localhost:8000/` → Log In as an account whose saved plan was stored before this field (meals have no `eaten`).
   - Expect: Today's menu shows an empty circle on every meal, with normal emphasis.

7. Food behavior without a live model
   - Open: `tests/test_prompts.py` and `tests/test_chat.py`. Not the page.
   - Do: Run those files. They do not call Gemini.
   - Expect: The edit prompt is still four pieces, includes the eaten-meal sentences, and puts `eaten` true inside the single plan JSON. The skipped-meal sentence remains, only for meals that are not eaten. A fake chat reply that rewrites a checked meal, drops it, or sets `eaten` false still returns that meal unchanged and still eaten, at the same index, or appended when the reply is too short for that index. An unchecked meal keeps the reply's foods with `eaten` false. If that reply omits an unchecked meal, the meal is absent and the server does not invent it. A reply cannot set `eaten` true on a meal the user did not check. Create and import store `eaten` false. This holds with the inspector off.

## Doc to update

`README.md`

One short note: checking a meal on Today's menu tells the coach that meal is already eaten and fixed, and chat plans the rest of the day around it until the circle is cleared. Do not add a new doc. Do not expand the endpoints table.

## Open questions

- None
