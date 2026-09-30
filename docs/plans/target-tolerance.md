# Target tolerance — implementation plan

PRD: `docs/prds/target-tolerance.md` (Approved). No open product decisions.

## Files to change

- `agent/schemas.py` — Add `target_tolerance_pct: int` on `UserProfile`, `Field(default=10, ge=1, le=20)`, same `Field` style as `calorie_target` and `meals_per_day`. Old `profile_json` with no key parses as 10 through the existing `UserProfile.model_validate_json` calls. No migration.
- `src/app/templates/onboarding.html` — After the Constraints `fieldset`, add one Preferences `fieldset` using the existing `.form-section` / `.form-section-title` / `.form-section-lead` classes. Inside it, one `<input type="range" min="1" max="20" step="1" value="10">` and a text node that shows the current integer plus `%` (starts at `10%`) and updates on the range `input` event. `collectProfilePayload` sends `target_tolerance_pct` as that integer. `fillProfileForm` sets the slider and the text from `profile.target_tolerance_pct`, and uses 10 when the key is missing.
- `agent/prompts.py` — In the value-helper section, format the band once: hard cap is `target_tolerance_pct`; "ideally within" is half of it. Even percents stay whole numbers (`10` → `5`). Odd percents use one decimal (`3` → `1.5`, `1` → `0.5`). `_build_shared_context` uses that phrase on the calorie line, replacing the hardcoded "ideally within 5% and never more than 10%". `_macro_targets` keeps omitting unset macros and, for each set macro, extends the current sentence to `Target {label}: {val}g per day, ideally within {half}%, never more than {pct}%.` Create, chat edit, and import adapt all call this shared context (`build_create_system_prompt` / `build_edit_system_prompt`; adapt already calls `build_create_system_prompt` in `agent/plan_import.py`).
- `evals/metrics/target_accuracy.py` — Both calorie and macro `_Check`s use `profile.target_tolerance_pct / 100`. Remove the fixed `CALORIE_TOLERANCE` / `MACRO_TOLERANCE` constants. At the default of 10, calories pass within ±10% and macros stay within ±10%. Rewrite the module docstring so it describes that percent. Do not add a refine loop.
- `eval_framework/judge_prompts/v1.md` — Edit only the calorie-miss sentence. The threshold is `target_tolerance_pct` on the context JSON already sent by `build_judge_user_payload`. When that key is absent, the sentence says to use 10. Leave the other three fail rules and the output shape as they are. Do not add a macro rule. Do not add `v2.md`.
- `README.md` — Under "Run the server", one short note: the preferences form has one slider, one percent applied to calories and to every macro target that is set, range 1–20, default 10.
- Tests in the files that already cover these units:
  - `tests/test_schemas.py` — default 10; `model_validate` of a profile dict with no key yields 10; 0 and 21 raise `ValidationError`.
  - `tests/test_prompts.py` — default prompt still says `ideally within 5%, never more than 10%`; `target_tolerance_pct=3` says `ideally within 1.5%, never more than 3%` on calories and on each set macro; unset macros stay omitted.
  - `tests/test_metrics.py` — a plan 9.1% off calories passes at the default of 10 and fails when `target_tolerance_pct` is 5. Update `test_target_accuracy_calorie_just_inside_5_percent` and `test_target_accuracy_calorie_just_outside_5_percent` to match the new default band.
  - `eval_framework/tests/test_judge.py` — `test_v1_exists_and_mentions_fail_rules` still passes. If the edited sentence no longer contains the literal `10%`, assert `target_tolerance_pct` and the absent-key default of 10 instead.

## Approach

Persistence and HTTP already round-trip a `UserProfile`. `agent/users.py` `save_profile` and `agent/session.py` store `profile.model_dump_json()`. `POST /plan` and `PUT /profile` parse a `UserProfile`. Do not edit those files. The new field rides the JSON the form already posts.

Import as-is stays on `_AS_IS_SYSTEM_PROMPT` in `agent/plan_import.py`. Do not edit that prompt. `tests/test_plan_import.py` (`test_import_freeform_as_is_structures_without_profile_targets`) must keep passing unchanged.

`compareToTarget` in `onboarding.html` stays `0.10`. The Daily total strip (`renderMacroCell`) does not print the percent or the "ideally within" sentence.

## Test command

`uv run pytest`

## Localhost

Start: `uv run uvicorn src.app.main:app --reload`, then `http://localhost:8000/`.

1. Slider lives in Preferences and spans the range. Continue as Guest so `#onboarding-view` and `#profile-form` are visible. The slider is in Preferences, not under Goals, Taste, or Constraints. It starts at 10%. Move it to 1%, then to 20%. The control shows `1%` and `20%`. It does not go below 1 or above 20.
2. A saved percent is still there after leaving. Signed in, with a plan on screen: Updated Preferences, set 15%, Save preferences. When the plan is showing again, open Updated Preferences. The slider shows 15%. A profile saved before this field existed, opened the same way, shows 10%.
3. The chosen percent is what the plan request carries. On the profile form, set 7%. In the network panel, Save & Build New Plan. The page does not show the system prompt. `POST /plan` includes `target_tolerance_pct` 7 with `calorie_target` and any filled macro targets. After the plan loads, the Daily total strip still shows kcal and, when those targets are set, P/C/F against those targets. It does not print the tolerance percent or the "ideally within" sentence.

## Not building

- A runtime refine loop, or a new `agent/validators.py`.
- Per-nutrient sliders or percents. A 0% value or "hit exactly" wording.
- The slider under Goals, Taste, or Constraints, or tabs on the form.
- Import-as-is target chasing. Leave `_AS_IS_SYSTEM_PROMPT` alone.
- New judge criteria, including macro scoring. No `v2.md`. No prompt interpolation in `eval_framework/judge.py`.
- A change to `compareToTarget`'s 10% ok/off color.
- A prompt inspector or any screen that prints the system prompt.
- A database migration, a new dependency, or a new doc besides the README note.
