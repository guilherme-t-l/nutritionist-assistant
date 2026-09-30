# Target tolerance

Status: Approved

## Problem

A meal plan is asked to land near the person's calorie target, and near each macro target they filled in. That allowed gap is fixed in the prompt and in the scorers. Calories are told "ideally within 5% and never more than 10%". Protein, carbs, and fat are told only "Target Xg per day" with no gap. The person cannot tighten or loosen that gap.

## User

Someone filling the profile form on first onboarding, or opening Updated Preferences later, who wants one setting for how far a day's totals may sit from the calorie target and from every macro target they set.

## Success signal

Moving one slider changes the percent stored on the profile, the percent the plan-building prompts use for calories and for each set macro, and the percent the existing scorers measure against. A saved profile that never had this field still behaves as 10%.

## In scope

- One slider in a new Preferences section on the existing profile form (`#profile-form` inside `#onboarding-view` in `src/app/templates/onboarding.html`). That form is the first-onboarding form and the Updated Preferences form. Current sections are Goals, Taste, and Constraints (fieldsets). Add one Preferences fieldset and put the slider there. Leave Goals, Taste, and Constraints as they are. Do not turn the form into tabs.
- The control shows the current integer percent (for example "10%") and updates as it moves. Range 1 through 20 inclusive. Step 1.
- Store `target_tolerance_pct` (int) on `UserProfile` in `agent/schemas.py`. Default 10. Bounds 1 through 20. Old `profile_json` rows have no such key. Loading them through the existing Pydantic profile parse must yield 10. No database migration. Profiles already persist as JSON on the user row and on the session row (`agent/users.py` `save_profile`, `agent/session.py`).
- The value travels in the profile body the form already sends: `POST /plan` and `PUT /profile` (`collectProfilePayload` in `onboarding.html`). Import already sends that same profile object.
- Prompts that chase targets use this percent for calories and for every macro that is set (`protein_g_target`, `carbs_g_target`, `fat_g_target`). Unset macros stay omitted. Paths: creating a plan (`build_create_system_prompt`), editing a plan in chat (`build_edit_system_prompt`), and adapting an imported plan (`build_create_system_prompt` inside import adapt). Today `_build_shared_context` hardcodes calories as "ideally within 5% and never more than 10%". `_macro_targets` emits "Target protein: Xg per day." with no band.
- Wording: the hard cap is the slider. The softer line stays automatic: "ideally within" is half the slider. Odd values use one decimal, so 3% reads "ideally within 1.5%, never more than 3%". Even values stay whole numbers, so 10% reads "ideally within 5%, never more than 10%". Minimum is 1%, so there is no "hit exactly" line.
- Import as-is keeps ignoring targets. It keeps the structure-only prompt in `agent/plan_import.py` and must not start using this tolerance.
- Scorers use the slider's full percent (the "never more than" number), not half of it. At the default of 10, calorie scoring moves from today's ±5% to ±10%; macro scoring stays ±10%.
  - `evals/metrics/target_accuracy.py`: `CALORIE_TOLERANCE` (0.05) and `MACRO_TOLERANCE` (0.10) both become the profile's `target_tolerance_pct`.
  - `eval_framework/judge_prompts/v1.md`: the calorie-miss fail line ("more than 10%") uses the profile's percentage. Do not add judge criteria. The judge does not score macros.
- No runtime refine loop and no new `agent/validators.py`. The setting steers the model through the prompt and is what the scorers measure against.

## Out of scope

- Separate sliders or percents per nutrient.
- A value of 0%, or any wording that means "hit the target exactly".
- Putting the slider under Goals, Taste, or Constraints, or redesigning the form into tabs.
- Changing import as-is so that it chases calorie or macro targets.
- A runtime refine loop or a new `agent/validators.py`.
- New judge criteria, including macro scoring in the judge.
- The plan card's ok/off color. `compareToTarget` in `onboarding.html` still marks a daily total ok when it is within 10% of the target. This feature does not change that color.
- A new screen that prints the system prompt.

## Acceptance checks

1. Slider lives in Preferences and spans the range
   - Open: `http://localhost:8000/` → Continue as Guest, so `#onboarding-view` and `#profile-form` are visible.
   - Do: Find the slider in the Preferences section (not under Goals, Taste, or Constraints). Read the percent on the control. Move it to 1%, then to 20%.
   - Expect: It starts at 10%. The control shows "1%" at the low end and "20%" at the high end. It does not move below 1% or above 20%.

2. A saved percent is still there after leaving
   - Open: `http://localhost:8000/` signed in, with a plan on screen.
   - Do: Click Updated Preferences. Set the slider to 15%. Click Save preferences. When the meal plan is showing again, click Updated Preferences.
   - Expect: The slider shows 15%. A profile that was saved before this field existed, opened the same way, shows 10%.

3. The chosen percent is what the plan request carries
   - Open: `http://localhost:8000/` profile form (Continue as Guest, or New plan).
   - Do: Set the slider to 7%. Open the browser network panel. Click Save & Build New Plan.
   - Expect: The page does not show the system prompt. There is no prompt inspector; do not add one. The `POST /plan` body includes `target_tolerance_pct` 7 together with `calorie_target` and any macro targets that were filled in. After the plan loads, the existing Daily total strip on the plan card still shows kcal, and P/C/F when those targets are set, against those targets. That strip does not print the tolerance percent or the "ideally within" sentence.

## Doc to update

`README.md`

Add a short note that the preferences form includes this slider: one percent applied to calories and to every macro target that is set, range 1–20, default 10. The README does not currently describe form fields. Do not add a new doc.

## Open questions

- None

## Locked product decisions (do not reopen these)

- One slider. One integer percent for calories and for every macro target that is set. No per-nutrient sliders.
- `UserProfile.target_tolerance_pct`, int, default 10, bounds 1 through 20 inclusive, step 1.
- Missing field on old `profile_json` behaves as 10% via the Pydantic default. No database migration.
- "Ideally within" is half the slider. Odd values use one decimal (3% → "ideally within 1.5%, never more than 3%"). No special wording for 0%.
- New Preferences fieldset on `#profile-form` only. Same form for first onboarding and Updated Preferences. Not under Goals, Taste, or Constraints. Not a tab widget.
- The control shows the current percent, for example "10%".
- The value rides the existing profile payload on `POST /plan` and `PUT /profile`.
- Create, chat edit, and import adapt prompts use this percent for calories and for each set macro. Import as-is keeps ignoring targets.
- `evals/metrics/target_accuracy.py` calorie and macro checks both use `target_tolerance_pct`. The judge calorie-miss threshold uses that same percentage. No new judge criteria.
- No runtime refine loop and no new `agent/validators.py`.
