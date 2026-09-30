"""Metric: how close are the plan's actual totals to the user's targets?

Calories and each set macro use the profile's `target_tolerance_pct`
(default 10, so ±10%). A calorie target of 2000 passes from 1800 to 2200.
If a macro target is None, that macro is skipped (not penalized).

Score is the fraction of *checked* targets that landed within tolerance.
"""

from __future__ import annotations

from dataclasses import dataclass

from agent.schemas import MealPlan, UserProfile
from evals.metrics import MetricResult


@dataclass
class _Check:
    """One target/actual pair, plus whether it landed within tolerance."""

    label: str
    target: int
    actual: int
    tolerance: float

    @property
    def delta_pct(self) -> float:
        # `abs(actual - target) / target` — fractional miss. Guard target=0
        # by short-circuiting earlier (we never check a None target here).
        return abs(self.actual - self.target) / self.target

    @property
    def within(self) -> bool:
        return self.delta_pct <= self.tolerance


def score(plan: MealPlan, profile: UserProfile) -> MetricResult:
    """Sum the plan's foods, compare to the profile's targets, score."""

    actual_calories = sum(
        food.calories for meal in plan.meals for food in meal.ingredients
    )
    actual_protein = sum(
        food.protein_g for meal in plan.meals for food in meal.ingredients
    )
    actual_carbs = sum(
        food.carbs_g for meal in plan.meals for food in meal.ingredients
    )
    actual_fat = sum(food.fat_g for meal in plan.meals for food in meal.ingredients)

    tolerance = profile.target_tolerance_pct / 100
    checks: list[_Check] = [
        _Check("calories", profile.calorie_target, actual_calories, tolerance),
    ]
    if profile.protein_g_target is not None:
        checks.append(
            _Check("protein", profile.protein_g_target, actual_protein, tolerance)
        )
    if profile.carbs_g_target is not None:
        checks.append(
            _Check("carbs", profile.carbs_g_target, actual_carbs, tolerance)
        )
    if profile.fat_g_target is not None:
        checks.append(
            _Check("fat", profile.fat_g_target, actual_fat, tolerance)
        )

    passed_count = sum(1 for c in checks if c.within)
    fraction = passed_count / len(checks)

    # `details` reads as `calories: 1840/2000 (-8.0%)  protein: 158/180 (-12.2%)`
    # — concise enough for a one-line summary, informative enough to debug.
    parts = [
        f"{c.label}: {c.actual}/{c.target} "
        f"({_signed_pct(c.actual, c.target)})"
        + ("" if c.within else " OFF")
        for c in checks
    ]
    return MetricResult(
        score=fraction,
        # `passed` only when ALL checks landed — a single miss is a fail at
        # the row level, even though `score` reports the partial credit.
        passed=passed_count == len(checks),
        details="  ".join(parts),
    )


def _signed_pct(actual: int, target: int) -> str:
    """Return e.g. '+3.2%' or '-12.4%'. Used in metric details."""
    delta = (actual - target) / target * 100.0
    sign = "+" if delta >= 0 else ""
    return f"{sign}{delta:.1f}%"
