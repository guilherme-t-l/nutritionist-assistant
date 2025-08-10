import { describe, it, expect } from "vitest";
import { MacroEngine } from "./macroEngine";
import { FOODS_FIXTURE, PIECE_MAP } from "./fixtures";

describe("MacroEngine", () => {
  it("computes item macros proportionally by grams vs basePortion", () => {
    const engine = new MacroEngine(FOODS_FIXTURE);
    const oats100 = engine.computeItemMacros("oats_rolled", { quantity: 100, unit: "g" });
    const oats50 = engine.computeItemMacros("oats_rolled", { quantity: 50, unit: "g" });
    expect(oats50.caloriesKcal).toBeCloseTo(oats100.caloriesKcal / 2, 5);
    expect(oats50.proteinG).toBeCloseTo(oats100.proteinG / 2, 5);
  });

  it("handles volume to mass via density for milk (ml -> g)", () => {
    const engine = new MacroEngine(FOODS_FIXTURE);
    const milk240 = engine.computeItemMacros("milk_skim", { quantity: 240, unit: "ml" });
    const milk100 = engine.computeItemMacros("milk_skim", { quantity: 100, unit: "ml" });
    expect(milk240.caloriesKcal).toBeCloseTo(milk100.caloriesKcal * 2.4, 5);
  });

  it("supports per-piece conversion with provided mapping (egg)", () => {
    const engine = new MacroEngine(FOODS_FIXTURE, { pieceToGramMap: PIECE_MAP });
    const egg1 = engine.computeItemMacros("egg_whole", { quantity: 1, unit: "piece" });
    const egg50g = engine.computeItemMacros("egg_whole", { quantity: 50, unit: "g" });
    expect(egg1.caloriesKcal).toBeCloseTo(egg50g.caloriesKcal, 5);
    expect(egg1.proteinG).toBeCloseTo(egg50g.proteinG, 5);
  });

  it("aggregates meal and day macros", () => {
    const engine = new MacroEngine(FOODS_FIXTURE, { pieceToGramMap: PIECE_MAP });
    const breakfast = engine.computeMealMacros([
      { foodId: "oats_rolled", portion: { quantity: 50, unit: "g" } },
      { foodId: "milk_skim", portion: { quantity: 240, unit: "ml" } },
    ]);
    const lunch = engine.computeMealMacros([
      { foodId: "egg_whole", portion: { quantity: 2, unit: "piece" } },
    ]);
    const day = engine.computeDayMacros([
      [
        { foodId: "oats_rolled", portion: { quantity: 50, unit: "g" } },
        { foodId: "milk_skim", portion: { quantity: 240, unit: "ml" } },
      ],
      [{ foodId: "egg_whole", portion: { quantity: 2, unit: "piece" } }],
    ]);

    expect(day.total.caloriesKcal).toBeCloseTo(breakfast.caloriesKcal + lunch.caloriesKcal, 5);
    expect(day.total.proteinG).toBeCloseTo(breakfast.proteinG + lunch.proteinG, 5);
  });
});

