import type { FoodItem } from "./types";

// Minimal validated fixtures (approximate typical values)
export const FOODS_FIXTURE: FoodItem[] = [
  {
    id: "oats_rolled",
    name: "Rolled Oats",
    basePortion: { quantity: 100, unit: "g" },
    macrosPerBase: {
      caloriesKcal: 389,
      proteinG: 16.9,
      carbsG: 66.3,
      fatG: 6.9,
      fiberG: 10.6,
      sugarG: 0.0,
    },
  },
  {
    id: "milk_skim",
    name: "Milk, skim",
    basePortion: { quantity: 100, unit: "ml" },
    densityGPerMl: 1.035, // approx
    macrosPerBase: {
      caloriesKcal: 34,
      proteinG: 3.4,
      carbsG: 5.0,
      fatG: 0.1,
      sugarG: 5.0,
    },
  },
  {
    id: "egg_whole",
    name: "Egg, whole",
    basePortion: { quantity: 50, unit: "g" }, // medium egg ~50g edible portion
    macrosPerBase: {
      caloriesKcal: 72,
      proteinG: 6.3,
      carbsG: 0.4,
      fatG: 4.8,
      sugarG: 0.2,
    },
  },
];

export const PIECE_MAP: Record<string, number> = {
  egg_whole: 50, // grams per piece
};

