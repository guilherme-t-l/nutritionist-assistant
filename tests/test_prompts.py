"""Unit tests for prompt building.

Because create/edit builders are pure functions, we can assert on the
exact phrases they emit — no LLM, no network, no fixtures.
"""

from __future__ import annotations

from agent.prompts import (
    _build_shared_context,
    _edit_job_instructions,
    build_assistant_note,
    build_create_system_prompt,
    build_edit_system_prompt,
    build_initial_user_message,
    format_personal_foods_section,
)
from agent.schemas import Food, Meal, MealPlan, PersonalFood, UserProfile


# Tiny MealPlan fixture for edit-prompt / assistant-note tests.
# `*` before `notes` means callers must pass notes by name
# (`notes="..."`), so we don't accidentally mix it up with positional args.
def _sample_plan(*, notes: str = "Swapped lunch for a lighter option.") -> MealPlan:
    return MealPlan(
        meals=[
            Meal(
                name="Almoço",
                description="Grilled chicken with salad",
                ingredients=[
                    Food(
                        name="grilled chicken",
                        quantity="150g",
                        calories=250,
                        protein_g=40,
                        carbs_g=0,
                        fat_g=8,
                    ),
                ],
            ),
        ],
        notes=notes,
    )


# --- Shared profile constraints (asserted via create prompt) -----------------


def test_system_prompt_includes_allergies_loudly() -> None:
    profile = UserProfile(
        goal="lose_weight",
        allergies=["peanuts", "shellfish"],
        calorie_target=1800,
        cuisine_preferences=["Mineira"],
    )

    prompt = build_create_system_prompt(profile)

    assert "peanuts" in prompt
    assert "shellfish" in prompt
    assert "Hard safety constraints" in prompt


def test_system_prompt_uses_none_known_when_allergies_empty() -> None:
    profile = UserProfile(goal="maintain", calorie_target=2000)

    prompt = build_create_system_prompt(profile)

    # The safety heading is always present; an empty list becomes "none known".
    assert "Allergies: none known" in prompt
    assert "Hard safety constraints" in prompt


def test_system_prompt_mentions_calorie_target_and_cuisines_plural() -> None:
    profile = UserProfile(
        goal="gain_muscle",
        calorie_target=2800,
        cuisine_preferences=["Bahian", "Japanese"],
    )

    prompt = build_create_system_prompt(profile)

    assert "2800" in prompt
    assert "Bahian" in prompt
    assert "Japanese" in prompt
    # The heading stays plural even when the profile has only one cuisine.
    assert "Preferred cuisines" in prompt
    assert "gain muscle" in prompt


def test_system_prompt_keeps_allergies_and_dislikes_distinct() -> None:
    # The whole point of Phase 1.5: safety and preference must NOT be merged.
    profile = UserProfile(
        goal="maintain",
        calorie_target=2000,
        allergies=["shellfish"],
        disliked_ingredients=["cilantro"],
    )

    prompt = build_create_system_prompt(profile)

    assert "Hard safety constraints" in prompt
    assert "shellfish" in prompt
    assert "Foods to avoid when reasonably possible" in prompt
    assert "cilantro" in prompt
    # Dislikes are listed first, then the safety heading. Slice each
    # section so a dislike cannot hide on the allergy line, or the reverse.
    avoid_start = prompt.index("Foods to avoid when reasonably possible")
    safety_start = prompt.index("Hard safety constraints")
    avoid_block = prompt[avoid_start:safety_start]
    safety_block = prompt[safety_start:]
    assert "cilantro" not in safety_block
    assert "shellfish" not in avoid_block


def test_system_prompt_uses_none_when_dislikes_empty() -> None:
    profile = UserProfile(
        goal="maintain",
        calorie_target=2000,
        allergies=["peanuts"],
    )

    prompt = build_create_system_prompt(profile)

    # The avoid line is always present; an empty list becomes "none".
    assert "Foods to avoid when reasonably possible: none" in prompt


def test_system_prompt_includes_macro_targets_when_set() -> None:
    profile = UserProfile(
        goal="gain_muscle",
        calorie_target=2800,
        protein_g_target=180,
        carbs_g_target=300,
        fat_g_target=80,
    )

    prompt = build_create_system_prompt(profile)

    assert "180" in prompt
    assert "300" in prompt
    assert "80" in prompt
    assert "protein" in prompt.lower()
    assert "carbs" in prompt.lower()
    assert "fat" in prompt.lower()


def test_system_prompt_uses_default_tolerance_band() -> None:
    profile = UserProfile(goal="maintain", calorie_target=2000)

    prompt = build_create_system_prompt(profile)

    assert "ideally within 5%, never more than 10%" in prompt
    assert "Target protein" not in prompt
    assert "Target carbs" not in prompt
    assert "Target fat" not in prompt


def test_system_prompt_uses_odd_tolerance_on_calories_and_set_macros() -> None:
    profile = UserProfile(
        goal="maintain",
        calorie_target=2000,
        protein_g_target=150,
        carbs_g_target=200,
        fat_g_target=60,
        target_tolerance_pct=3,
    )

    prompt = build_create_system_prompt(profile)

    band = "ideally within 1.5%, never more than 3%"
    assert f"2000 kcal/day, {band}." in prompt
    assert f"Target protein: 150g per day, {band}." in prompt
    assert f"Target carbs: 200g per day, {band}." in prompt
    assert f"Target fat: 60g per day, {band}." in prompt


def test_system_prompt_omits_unset_macros_when_tolerance_is_set() -> None:
    profile = UserProfile(
        goal="gain_muscle",
        calorie_target=2500,
        protein_g_target=150,
        target_tolerance_pct=3,
    )

    prompt = build_create_system_prompt(profile)

    assert "ideally within 1.5%, never more than 3%" in prompt
    assert "Target protein" in prompt
    assert "Target carbs" not in prompt
    assert "Target fat" not in prompt


def test_system_prompt_omits_macro_targets_when_unset() -> None:
    profile = UserProfile(goal="maintain", calorie_target=2000)

    prompt = build_create_system_prompt(profile)

    # None of the macro-target lines should appear when the user set none.
    assert "Target protein" not in prompt
    assert "Target carbs" not in prompt
    assert "Target fat" not in prompt


def test_system_prompt_includes_only_set_macro_targets() -> None:
    # Partial set: only protein. Prompt should mention it but NOT carbs/fat.
    profile = UserProfile(
        goal="gain_muscle",
        calorie_target=2500,
        protein_g_target=150,
    )

    prompt = build_create_system_prompt(profile)

    assert "150" in prompt
    assert "Target protein" in prompt
    assert "Target carbs" not in prompt
    assert "Target fat" not in prompt


def test_system_prompt_states_meal_count() -> None:
    profile = UserProfile(goal="maintain", calorie_target=2000, meals_per_day=5)

    prompt = build_create_system_prompt(profile)

    # Create mode must hard-require the profile meal count.
    assert "exactly 5 meals" in prompt


def test_system_prompt_includes_flavor_profiles_when_set() -> None:
    profile = UserProfile(
        goal="maintain",
        calorie_target=2000,
        flavor_profiles=["savory", "umami"],
    )

    prompt = build_create_system_prompt(profile)

    assert "savory" in prompt
    assert "umami" in prompt


# --- Create-only -------------------------------------------------------------


def test_create_prompt_states_create_job_and_omits_edit_plan() -> None:
    profile = UserProfile(goal="maintain", calorie_target=2000)

    prompt = build_create_system_prompt(profile)

    assert "CREATE a realistic daily meal plan from scratch" in prompt
    assert "Current meal plan" not in prompt
    assert "Editing principles" not in prompt
    assert "When the user asks for a change" not in prompt


# --- Edit-only ---------------------------------------------------------------


def test_edit_prompt_is_four_pieces_and_locks_eaten_meals_in_one_json() -> None:
    profile = UserProfile(
        goal="maintain",
        calorie_target=2000,
        allergies=["peanuts"],
        meals_per_day=3,
    )
    eaten = Meal(
        name="Breakfast",
        description="Already eaten.",
        eaten=True,
        ingredients=[
            Food(
                name="tapioca",
                quantity="1 unit",
                calories=300,
                protein_g=4,
                carbs_g=50,
                fat_g=8,
            ),
        ],
    )
    later = Meal(
        name="Lunch",
        description="Still open.",
        eaten=False,
        ingredients=[
            Food(
                name="rice",
                quantity="1 xícara",
                calories=200,
                protein_g=4,
                carbs_g=40,
                fat_g=1,
            ),
        ],
    )
    plan = MealPlan(meals=[eaten, later], notes="Leave breakfast.")
    food = _pancake()

    prompt = build_edit_system_prompt(profile, plan, [food])
    plan_json = plan.model_dump_json()
    assert prompt == (
        _build_shared_context(profile)
        + format_personal_foods_section([food])
        + _edit_job_instructions(profile.meals_per_day)
        + plan_json
    )
    # Guest chat inserts an empty personal-foods piece. Still four pieces.
    bare = build_edit_system_prompt(profile, plan)
    assert bare == (
        _build_shared_context(profile)
        + format_personal_foods_section([])
        + _edit_job_instructions(profile.meals_per_day)
        + plan_json
    )
    assert prompt.count(plan_json) == 1
    assert bare.count(plan_json) == 1
    loaded = MealPlan.model_validate_json(plan_json)
    assert loaded.meals[0].eaten is True
    assert loaded.meals[1].eaten is False
    assert "A meal with eaten true was already eaten." in prompt
    assert "Copy it exactly." in prompt
    assert "Do not rewrite, remove, or redistribute it." in prompt
    assert (
        "Fit the other meals around the calories and macros those eaten meals already use."
        in prompt
    )
    assert (
        "The reply's one plan JSON must still include every meal that is not eaten, rewritten to fit the day."
        in prompt
    )
    assert "Do not return a plan that contains only the eaten meals." in prompt
    assert "Remove a meal only when the user skipped a meal that is not eaten." in prompt
    assert "If the user says they skipped a meal that is not eaten" in prompt
    assert "If the user says they skipped a meal, treat it as not eaten" not in prompt


def test_edit_prompt_includes_edit_job_and_current_plan() -> None:
    profile = UserProfile(goal="maintain", calorie_target=2000)
    plan = _sample_plan()

    prompt = build_edit_system_prompt(profile, plan)

    assert "EDIT the current meal plan" in prompt
    assert "Editing principles" in prompt
    assert "Current meal plan:" in prompt
    assert "Almoço" in prompt
    assert "grilled chicken" in prompt
    # The whole serialized plan should appear — that's the source of truth.
    assert plan.model_dump_json() in prompt
    # Create-from-scratch must not be the primary job in edit mode.
    assert "CREATE a realistic daily meal plan from scratch" not in prompt


def test_edit_prompt_includes_shared_profile_constraints() -> None:
    profile = UserProfile(
        goal="lose_weight",
        calorie_target=1800,
        allergies=["peanuts"],
        meals_per_day=4,
    )
    plan = _sample_plan()

    prompt = build_edit_system_prompt(profile, plan)

    assert "Brazilian nutritionist" in prompt
    assert "1800" in prompt
    assert "Hard safety constraints" in prompt
    assert "peanuts" in prompt
    # Usual count is guidance; create's hard lock must not appear in edit.
    assert "usual meal count is 4" in prompt
    assert "Produce a full day of exactly" not in prompt


def _pancake() -> PersonalFood:
    return PersonalFood(
        id="pancake-1",
        name="Special Pancake",
        serving_size=1,
        serving_unit="pancake",
        calories=140,
        protein_g=10,
        carbs_g=12,
        fat_g=4,
        ingredients=["oat flour", "egg"],
    )


def test_edit_prompt_with_no_foods_matches_prompt_without_library() -> None:
    profile = UserProfile(goal="maintain", calorie_target=2000)
    plan = _sample_plan()

    bare = build_edit_system_prompt(profile, plan)
    empty = build_edit_system_prompt(profile, plan, [])

    assert bare == empty
    assert "Personal foods" not in bare


def test_edit_prompt_includes_library_rules_and_still_has_the_plan() -> None:
    profile = UserProfile(
        goal="maintain",
        calorie_target=2000,
        allergies=["peanuts"],
    )
    plan = _sample_plan()
    food = _pancake()

    prompt = build_edit_system_prompt(profile, plan, [food])

    assert "Special Pancake" in prompt
    assert "1 pancake" in prompt
    assert "140 kcal" in prompt
    assert "oat flour" in prompt
    assert "not approved, not recommended, and not preferred" in prompt
    assert "Do not insert personal foods on your own." in prompt
    assert "Do not prefer a personal food only because it is in this list." in prompt
    assert "Do not limit suggestions to this list." in prompt
    assert "Allergies still win." in prompt
    assert plan.model_dump_json() in prompt
    assert "Current meal plan:" in prompt
    # Profile constraints, then the library, then the plan being edited.
    assert prompt.index("peanuts") < prompt.index("Personal foods")
    assert prompt.index("Personal foods") < prompt.index("Current meal plan:")


def test_create_prompt_does_not_include_the_library() -> None:
    profile = UserProfile(goal="maintain", calorie_target=2000)

    prompt = build_create_system_prompt(profile)

    assert "Personal foods" not in prompt
    assert "Special Pancake" not in prompt


# --- User / assistant message helpers ----------------------------------------


# First user turn is just the task. Calories / cuisine / meal count already
# live in the system prompt, so repeating them here would waste tokens.
def test_initial_user_message_is_short_task_without_profile_fields() -> None:
    message = build_initial_user_message()

    assert message == "Generate my meal plan based on my goals and preferences."
    assert "2100" not in message
    assert "Paulista" not in message
    assert "Japanese" not in message


# History stores a short note (usually plan.notes), not the full MealPlan JSON.
def test_assistant_note_uses_plan_notes() -> None:
    plan = _sample_plan(notes="Made lunch lighter.")

    assert build_assistant_note(plan) == "Made lunch lighter."


# If the model left notes blank (or whitespace-only), we still need something
# short to append to history — never an empty string or a full plan dump.
def test_assistant_note_falls_back_when_notes_empty() -> None:
    plan = _sample_plan(notes="   ")

    assert build_assistant_note(plan) == "Updated the meal plan."
