# Prompt building. Pure functions, no I/O — string in, string out.
#
# Why this file exists:
#   1. Unit-test prompt wording without calling the LLM.
#   2. Change create or edit instructions in one place, then run evals.
#
# Every LLM call gets two strings:
#   system    — instructions, one long string built by gluing the parts below
#   messages  — the conversation (one user task, or later turns)
#
# The parts, in the order they can appear:
#
#   1. Shared context   _build_shared_context
#                       who the agent is + this user's constraints
#   2. Create job       _create_job_instructions
#                       "invent a full day of N meals"
#   3. Personal foods   format_personal_foods_section
#                       foods this user already saved (left out when the list is empty)
#   4. Edit job         _edit_job_instructions
#                       "change the plan below, as little as possible"
#   5. Plan JSON        plan.model_dump_json()
#                       the current meal plan
#   6. User message     the task in the conversation (not inside the system string)
#
# Which call uses which parts (top to bottom):
#
#   /plan
#     system   = 1 + 2
#     message  = "Generate my meal plan…"
#
#   /chat
#     system   = 1 + 3 + 4 + 5
#     messages = the chat history (built in the route, not here)
#
#   /plan/import as_is
#     system   = a short "only structure this" prompt in plan_import.py
#     message  = "Convert the following…" + the pasted or PDF text
#
#   /plan/import adapt
#     system   = (1 + 2) + 3 + an "edit this import" suffix in plan_import.py
#     message  = "Here is my existing meal plan…" + the pasted or PDF text
#
# Part 1 is a few sentences filled from the profile, in this order:
#   persona → goal → calories and tolerance → macros (only if set)
#   → cuisines, flavors, foods to avoid → allergies

from __future__ import annotations

from agent.schemas import MealPlan, PersonalFood, UserProfile


# ---------------------------------------------------------------------------
# Fixed phrases dropped into the parts above
# ---------------------------------------------------------------------------

# Blank inside part 1. profile.goal "lose_weight" → "lose weight gradually…".
# Leading underscore = module-private: other files should not import this.
_GOAL_PHRASING = {
    "lose_weight": "lose weight gradually and sustainably",
    "maintain": "maintain their current weight",
    "gain_muscle": "gain muscle mass",
}

# Part 6 for /plan. The profile already sits in the system string,
# so this message is only the task.
_INITIAL_USER_MESSAGE = "Generate my meal plan based on my goals and preferences."

# Start of part 6 for /plan/import as_is. The pasted plan is appended after it.
_IMPORT_USER_MESSAGE_PREFIX = (
    "Convert the following meal plan into the required MealPlan JSON schema. "
    "Keep the user's meals and ingredients as close as possible — do not "
    "rewrite them to match preferences:\n\n"
)

# Start of part 6 for /plan/import adapt. The pasted plan is appended after it.
_IMPORT_ADAPT_USER_MESSAGE_PREFIX = (
    "Here is my existing meal plan. Edit it to match my preferences "
    "(targets, allergies, dislikes, cuisines, meals per day). Keep what "
    "already fits; change what doesn't:\n\n"
)

# Part 2. Comes right after shared context. No plan JSON — there isn't one yet.
def _create_job_instructions(meals_per_day: int) -> str:
    return f"""

Your job is to CREATE a realistic daily meal plan from scratch using Brazilian ingredients and cooking traditions, adapted to the user's preferences. Prioritize balance and variety across the day.

Produce a full day of exactly {meals_per_day} meals.
"""


# Part 4. Ends with "Current meal plan:" so part 5 (the JSON) follows immediately.
def _edit_job_instructions(meals_per_day: int) -> str:
    return f"""

Your job is to EDIT the current meal plan (below), not create a new one from scratch. The current plan is the baseline: assume the user likes it unless they explicitly say otherwise or ask for a completely new plan.

Editing principles:

- Make the smallest set of changes that satisfies the user's request while keeping the plan practical, balanced, and realistic. Keep changes local to the request: do not touch unrelated meals or add optimizations nobody asked for.
- Escalate only when necessary, in this order of preference:
  1. Adjust quantities of existing foods.
  2. Replace individual foods within a meal / Modify a single meal.
  3. Modify multiple meals.
  4. Rewrite the entire plan — only when smaller changes cannot reasonably satisfy the request or the nutritional requirements. If you do this, explicitly explain to the user why a larger rewrite was necessary.
- When changing foods, prefer variety across the day: avoid unnecessarily repeating the same ingredient or protein source across multiple meals, especially for non-common foods.
- A meal with eaten true was already eaten. Copy it exactly. Do not rewrite, remove, or redistribute it. Fit the other meals around the calories and macros those eaten meals already use.
- The reply's one plan JSON must still include every meal that is not eaten, rewritten to fit the day. Do not return a plan that contains only the eaten meals. Remove a meal only when the user skipped a meal that is not eaten.
- If the user says they skipped a meal that is not eaten, treat it as not eaten: remove it and redistribute its calories and macros across the rest of the day as appropriate.
- The result should feel like a carefully edited version of the existing plan that preserves the user's food preferences and eating patterns — not a new plan with similar calories and macros.
- The user's usual meal count is {meals_per_day}. Treat this as the default, not a requirement. Prefer preserving the number of meals when it reasonably satisfies the user's request, but increase or decrease it whenever doing so results in a more practical, a more natural meal plan, or if the user skipped a meal that is not eaten...

Current meal plan:
"""


# ---------------------------------------------------------------------------
# Part 1 — shared context. Create and edit both start here.
# ---------------------------------------------------------------------------
# The sentences in the return are what the model reads.
# Helpers at the bottom of this file only fill the blanks.
def _build_shared_context(profile: UserProfile) -> str:
    goal = _GOAL_PHRASING.get(profile.goal, profile.goal)
    allergies = _allergies(profile.allergies)
    dislikes = _dislikes(profile.disliked_ingredients)
    cuisines = _cuisines(profile.cuisine_preferences)
    flavors = _flavors(profile.flavor_profiles)
    macros = _macro_targets(profile)

    return (
    "You are a warm, practical Brazilian nutritionist who creates realistic, enjoyable meal plans using foods the user is likely to eat.\n\n"

    "Primary objective:\n"
    f"- Help the user {goal}.\n"
    f"- Target approximately {profile.calorie_target} kcal/day, {_tolerance_band(profile.target_tolerance_pct)}.\n"
    f"{macros}"

    "Preferences:\n"
    f"- Preferred cuisines: {cuisines}. Feel free to mix them naturally throughout the day.\n"
    f"- Preferred flavor profiles: {flavors}.\n"
    f"- Foods to avoid when reasonably possible: {dislikes}.\n\n"

    "Hard safety constraints:\n"
    f"- Allergies: {allergies}.\n"
    "- Never include these ingredients or foods that commonly contain them.\n\n"
    )


# ---------------------------------------------------------------------------
# Glue the parts into one system string
# ---------------------------------------------------------------------------

# /plan (and the start of import adapt): part 1, then part 2.
def build_create_system_prompt(profile: UserProfile) -> str:
    return (
        _build_shared_context(profile)  # 1. shared context
        + _create_job_instructions(profile.meals_per_day)  # 2. create job
    )


# /chat: part 1 + part 3 + part 4 + part 5.
# Part 3 is "" when this user has no saved foods, so nothing is inserted there.
def build_edit_system_prompt(
    profile: UserProfile,
    plan: MealPlan,
    personal_foods: list[PersonalFood] | None = None,
) -> str:
    return (
        _build_shared_context(profile)  # 1. shared context
        + format_personal_foods_section(personal_foods or [])  # 3. or ""
        + _edit_job_instructions(profile.meals_per_day)  # 4. edit job
        + plan.model_dump_json()  # 5. plan JSON
    )


# Part 3, for /chat and for import adapt.
# "" when the list is empty — we never write "Personal foods: none."
def format_personal_foods_section(foods: list[PersonalFood]) -> str:
    if not foods:
        return ""
    lines = [_format_personal_food_line(food) for food in foods]
    catalog = "\n".join(lines)
    return f"""
Personal foods this user already eats (context only — not the meal plan):

The current meal plan is the anchor. These are foods this user eats. They are not approved, not recommended, and not preferred over the meal plan.

Use a personal food only when one of these is true:
1. The user explicitly asks for it (for example, "I want my pancakes tomorrow"). Choose a quantity that fits the day's targets, and add other foods if that serving alone misses the meal.
2. The user asks for a substitution (for example, "What can I eat instead of breakfast?"). Personal foods are options alongside other suitable foods, not the whole menu.
3. The user says they already have it (for example, "I have my pancakes ready"). Fit that food into the meal and keep the nutritional targets.

Do not insert personal foods on your own.
Do not prefer a personal food only because it is in this list.
Do not limit suggestions to this list.
Allergies still win. A personal food that conflicts with an allergy is not used.
Macros below are for one serving. Multiply by the number of servings you choose, then round to whole kcal and grams.

{catalog}
"""


# ---------------------------------------------------------------------------
# Conversation lines. These are not inside the system string.
# The three builders below are part 6 (the user task).
# build_assistant_note is the short model reply stored in history.
# ---------------------------------------------------------------------------

# /plan's first user message. Same shape as later turns: system + messages.
def build_initial_user_message() -> str:
    return _INITIAL_USER_MESSAGE


# /plan/import as_is: the prefix above + the pasted or PDF text.
# .strip() drops leading and trailing whitespace so we don't spend tokens on it.
def build_import_user_message(source_text: str) -> str:
    return _IMPORT_USER_MESSAGE_PREFIX + source_text.strip()


# /plan/import adapt: the adapt prefix above + the pasted or PDF text.
def build_import_adapt_user_message(source_text: str) -> str:
    return _IMPORT_ADAPT_USER_MESSAGE_PREFIX + source_text.strip()


# Stored in chat history in place of the full plan JSON.
# The plan itself is already re-sent as part 5 on the next /chat turn.
# Uses the model's own `notes` when it wrote some; otherwise a short fallback.
def build_assistant_note(plan: MealPlan) -> str:
    note = plan.notes.strip()
    if note:
        return note
    return "Updated the meal plan."


# ---------------------------------------------------------------------------
# Blanks inside part 1, plus one catalog line inside part 3.
# Each returns a short phrase, not its own section of the prompt.
# An empty list becomes a default word ("none", "none known") so the
# sentence still reads when the user left that field blank.
# ---------------------------------------------------------------------------

# ['peanuts', 'shellfish'] → 'peanuts, shellfish' ; [] → 'none known'
def _allergies(allergies: list[str]) -> str:
    if not allergies:
        return "none known"
    return ", ".join(allergies)


# ['cilantro'] → 'cilantro' ; [] → 'none'
def _dislikes(dislikes: list[str]) -> str:
    if not dislikes:
        return "none"
    return ", ".join(dislikes)


# ['Bahian', 'Japanese'] → 'Bahian and Japanese' ; [] → 'any Brazilian-leaning'
def _cuisines(cuisines: list[str]) -> str:
    if not cuisines:
        return "any Brazilian-leaning"
    return _join_natural(cuisines)


# ['savory', 'umami'] → 'savory, umami' ; [] → 'no strong preference'
def _flavors(flavors: list[str]) -> str:
    if not flavors:
        return "no strong preference"
    return ", ".join(flavors)


# Hard cap is the slider. "Ideally within" is half of it.
# Even percents stay whole (10 → 5). Odd percents use one decimal (3 → 1.5).
def _tolerance_band(pct: int) -> str:
    half_text = str(pct // 2) if pct % 2 == 0 else f"{pct / 2:.1f}"
    return f"ideally within {half_text}%, never more than {pct}%"


# Optional macro targets (g/day). Returns "" when none are set so the shared
# prompt does not gain a blank line for unset fields.
def _macro_targets(profile: UserProfile) -> str:
    # (label_for_prompt, value_from_profile) pairs so we can loop the same way.
    targets: list[tuple[str, int | None]] = [
        ("protein", profile.protein_g_target),
        ("carbs", profile.carbs_g_target),
        ("fat", profile.fat_g_target),
    ]
    # Keep only macros the user actually set (value is not None).
    set_targets = [(label, val) for label, val in targets if val is not None]
    if not set_targets:
        return ""
    band = _tolerance_band(profile.target_tolerance_pct)
    lines = [f"Target {label}: {val}g per day, {band}." for label, val in set_targets]
    # Join with newlines and end with \n so the next prompt line sits cleanly.
    return "\n".join(lines) + "\n"


# 1.0 → "1" ; 1.5 → "1.5". Used in a personal-food catalog line (part 3).
def _format_serving_size(value: float) -> str:
    if float(value).is_integer():
        return str(int(value))
    return f"{value:g}"


# One bullet in the part 3 catalog: name, serving, macros, ingredients if any.
def _format_personal_food_line(food: PersonalFood) -> str:
    size = _format_serving_size(food.serving_size)
    line = (
        f"- {food.name} — {size} {food.serving_unit} — "
        f"{food.calories} kcal, {food.protein_g}g protein, "
        f"{food.carbs_g}g carbs, {food.fat_g}g fat per serving."
    )
    if food.ingredients:
        # Notes for the agent ("what's in it"). Not extra macros.
        line += " Ingredients: " + ", ".join(food.ingredients) + "."
    return line


# Natural-language list join:
#   ['Bahian', 'Japanese']            → 'Bahian and Japanese'
#   ['Bahian', 'Japanese', 'Mineira'] → 'Bahian, Japanese and Mineira'
def _join_natural(items: list[str]) -> str:
    if not items:
        return ""
    if len(items) == 1:
        return items[0]
    # items[:-1] = all but last; items[-1] = last item.
    return ", ".join(items[:-1]) + " and " + items[-1]
