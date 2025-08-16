import { describe, it, expect } from "vitest";
import { MacroEngine } from "./macroEngine";
import { FOODS_FIXTURE, PIECE_MAP } from "./fixtures";

describe("MacroEngine", () => {
  it("computes item macros proportionally by grams vs basePortion", async () => {
    const engine = new MacroEngine(FOODS_FIXTURE);
    const oats100 = await engine.computeItemMacros("oats_rolled", { quantity: 100, unit: "g" });
    const oats50 = await engine.computeItemMacros("oats_rolled", { quantity: 50, unit: "g" });
    expect(oats50.caloriesKcal).toBeCloseTo(oats100.caloriesKcal / 2, 5);
    expect(oats50.proteinG).toBeCloseTo(oats100.proteinG / 2, 5);
  });

  it("handles volume to mass via density for milk (ml -> g)", async () => {
    const engine = new MacroEngine(FOODS_FIXTURE);
    const milk240 = await engine.computeItemMacros("milk_skim", { quantity: 240, unit: "ml" });
    const milk100 = await engine.computeItemMacros("milk_skim", { quantity: 100, unit: "ml" });
    expect(milk240.caloriesKcal).toBeCloseTo(milk100.caloriesKcal * 2.4, 5);
  });

  it("supports per-piece conversion with provided mapping (egg)", async () => {
    const engine = new MacroEngine(FOODS_FIXTURE, { pieceToGramMap: PIECE_MAP });
    const egg1 = await engine.computeItemMacros("egg_whole", { quantity: 1, unit: "piece" });
    const egg50g = await engine.computeItemMacros("egg_whole", { quantity: 50, unit: "g" });
    expect(egg1.caloriesKcal).toBeCloseTo(egg50g.caloriesKcal, 5);
    expect(egg1.proteinG).toBeCloseTo(egg50g.proteinG, 5);
  });

  it("aggregates meal and day macros", async () => {
    const engine = new MacroEngine(FOODS_FIXTURE, { pieceToGramMap: PIECE_MAP });
    const breakfast = await engine.computeMealMacros([
      { foodId: "oats_rolled", portion: { quantity: 50, unit: "g" } },
      { foodId: "milk_skim", portion: { quantity: 240, unit: "ml" } },
    ]);
    const lunch = await engine.computeMealMacros([
      { foodId: "egg_whole", portion: { quantity: 2, unit: "piece" } },
    ]);
    const day = await engine.computeDayMacros([
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

