# Turn Pydantic's validation errors into one plain sentence per field.
#
# FastAPI's default 422 body is a list of technical messages ("Field required",
# "Input should be greater than or equal to 800"). The page shows whatever
# string we put in `detail`, so this is the only wording the person sees.

from __future__ import annotations


_LABELS = {
    "goal": "Goal",
    "calorie_target": "Calorie target",
    "protein_g_target": "Protein target",
    "carbs_g_target": "Carbs target",
    "fat_g_target": "Fat target",
    "meals_per_day": "Meals per day",
    "target_tolerance_pct": "Target tolerance",
    "cuisine_preferences": "Cuisines",
    "flavor_profiles": "Flavors",
    "allergies": "Allergies",
    "disliked_ingredients": "Disliked ingredients",
    "message": "Message",
    "source_text": "Plan text",
    "mode": "Import mode",
    "profile": "Profile",
    "name": "Name",
    "serving_unit": "Serving unit",
    "serving_size": "Serving size",
    "calories": "Calories",
    "protein_g": "Protein",
    "carbs_g": "Carbs",
    "fat_g": "Fat",
}

_RANGE_TYPES = {
    "greater_than_equal",
    "less_than_equal",
    "greater_than",
    "less_than",
}


def friendly_validation(errors: list[dict]) -> str:
    """One readable sentence per problem, joined into a single string."""
    parts = [_one(error) for error in errors]
    parts = [part for part in parts if part]
    if not parts:
        return "Check the form and try again."
    return " ".join(parts)


def _one(error: dict) -> str:
    loc = [
        part
        for part in error.get("loc", ())
        if part not in ("body", "query", "path") and not isinstance(part, int)
    ]
    field = str(loc[-1]) if loc else ""
    label = _LABELS.get(field, field.replace("_", " ").capitalize() if field else "This field")
    kind = error.get("type") or ""

    if field == "message" and kind == "string_too_long":
        return "Message is too long. Keep it under 1,000 characters."
    if field == "message" and kind in ("string_too_short", "missing"):
        return "Message is required."
    if kind == "missing":
        return f"{label} is required."
    if kind in _RANGE_TYPES:
        return f"{label} is out of range."
    if kind == "literal_error":
        return f"{label} has a value that isn't allowed."
    if kind in ("int_parsing", "int_type", "float_parsing", "float_type"):
        return f"{label} must be a number."
    if kind == "json_invalid":
        return "That request wasn't valid JSON."

    msg = (error.get("msg") or "is invalid").rstrip(".")
    return f"{label}: {msg}."
