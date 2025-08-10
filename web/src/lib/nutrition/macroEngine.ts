import { portionToGrams, isMassUnit, isVolumeUnit } from "./units";
import type { FoodItem, MealItemInput, AggregatedMacros } from "./types";

export interface MacroEngineOptions {
  /**
   * Default grams for a single piece when a food has a known per-piece weight.
   * Supplied via a mapping at call time when available.
   */
  pieceToGramMap?: Record<string, number>; // foodId -> grams per piece
}

export class MacroEngine {
  private foodIndex: Map<string, FoodItem>;
  private options: MacroEngineOptions;

  constructor(foods: FoodItem[], options: MacroEngineOptions = {}) {
    this.foodIndex = new Map(foods.map((f) => [f.id, f]));
    this.options = options;
  }

  getFood(foodId: string): FoodItem {
    const food = this.foodIndex.get(foodId);
    if (!food) throw new Error(`Unknown foodId: ${foodId}`);
    return food;
  }

  /**
   * Convert an input portion to grams using available metadata.
   */
  private resolvePortionGrams(food: FoodItem, portion: { quantity: number; unit: string }): number {
    const unit = portion.unit as any;
    if (unit === "piece") {
      const grams = this.options.pieceToGramMap?.[food.id];
      if (grams == null) throw new Error(`Missing grams per piece for food ${food.id}`);
      return portion.quantity * grams;
    }
    if (isMassUnit(unit) || isVolumeUnit(unit)) {
      return portionToGrams(portion.quantity, unit, food.densityGPerMl);
    }
    throw new Error(`Unsupported unit: ${portion.unit}`);
  }

  /**
   * Compute macros for a given portion, normalizing from the food's basePortion.
   */
  computeItemMacros(foodId: string, portion: { quantity: number; unit: string }): AggregatedMacros {
    const food = this.getFood(foodId);
    const grams = this.resolvePortionGrams(food, portion);

    // Normalize to grams of basePortion (typically 100g)
    const baseGrams = this.resolvePortionGrams(food, food.basePortion);
    const ratio = grams / baseGrams;
    const m = food.macrosPerBase;
    return {
      caloriesKcal: m.caloriesKcal * ratio,
      proteinG: m.proteinG * ratio,
      carbsG: m.carbsG * ratio,
      fatG: m.fatG * ratio,
      fiberG: m.fiberG != null ? m.fiberG * ratio : undefined,
      sugarG: m.sugarG != null ? m.sugarG * ratio : undefined,
    };
  }

  /**
   * Aggregate macros for a list of meal items.
   */
  computeMealMacros(items: MealItemInput[]): AggregatedMacros {
    return items.reduce<AggregatedMacros>(
      (acc, item) => {
        const m = this.computeItemMacros(item.foodId, item.portion);
        return {
          caloriesKcal: acc.caloriesKcal + m.caloriesKcal,
          proteinG: acc.proteinG + m.proteinG,
          carbsG: acc.carbsG + m.carbsG,
          fatG: acc.fatG + m.fatG,
          fiberG: (acc.fiberG ?? 0) + (m.fiberG ?? 0),
          sugarG: (acc.sugarG ?? 0) + (m.sugarG ?? 0),
        };
      },
      { caloriesKcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sugarG: 0 }
    );
  }

  /**
   * Aggregate macros for a day (array of meals), returning total and per-meal breakdown.
   */
  computeDayMacros(meals: MealItemInput[][]): { total: AggregatedMacros; perMeal: AggregatedMacros[] } {
    const perMeal = meals.map((items) => this.computeMealMacros(items));
    const total = perMeal.reduce<AggregatedMacros>(
      (acc, m) => ({
        caloriesKcal: acc.caloriesKcal + m.caloriesKcal,
        proteinG: acc.proteinG + m.proteinG,
        carbsG: acc.carbsG + m.carbsG,
        fatG: acc.fatG + m.fatG,
        fiberG: (acc.fiberG ?? 0) + (m.fiberG ?? 0),
        sugarG: (acc.sugarG ?? 0) + (m.sugarG ?? 0),
      }),
      { caloriesKcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sugarG: 0 }
    );
    return { total, perMeal };
  }
}

