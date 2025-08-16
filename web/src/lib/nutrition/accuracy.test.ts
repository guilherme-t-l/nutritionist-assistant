import { describe, it, expect } from "vitest";
import { MacroEngine } from "./macroEngine";
import { FOOD_DATABASE } from "./foodDatabase";
import { PIECE_MAP } from "./fixtures";

describe("Macro Engine Accuracy Validation", () => {
  const engine = new MacroEngine(FOOD_DATABASE, { pieceToGramMap: PIECE_MAP });

  // Validated test cases with known accurate macro values
  const validatedCases = [
    {
      name: "Rolled Oats - 50g",
      foodId: "oats_rolled",
      portion: { quantity: 50, unit: "g" },
      expected: {
        caloriesKcal: 194.5, // 389 * 0.5
        proteinG: 8.45,      // 16.9 * 0.5
        carbsG: 33.15,       // 66.3 * 0.5
        fatG: 3.45,          // 6.9 * 0.5
      }
    },
    {
      name: "Chicken Breast - 150g",
      foodId: "chicken_breast_cooked",
      portion: { quantity: 150, unit: "g" },
      expected: {
        caloriesKcal: 247.5, // 165 * 1.5
        proteinG: 46.5,      // 31 * 1.5
        carbsG: 0,           // 0 * 1.5
        fatG: 5.4,           // 3.6 * 1.5 (corrected from 5.55)
      }
    },
    {
      name: "Brown Rice - 200g",
      foodId: "brown_rice_cooked",
      portion: { quantity: 200, unit: "g" },
      expected: {
        caloriesKcal: 222,   // 111 * 2
        proteinG: 5.2,       // 2.6 * 2
        carbsG: 46.0,        // 23.0 * 2
        fatG: 1.8,           // 0.9 * 2
      }
    },
    {
      name: "Whole Egg - 2 pieces (100g total)",
      foodId: "egg_whole",
      portion: { quantity: 2, unit: "piece" },
      expected: {
        caloriesKcal: 155,   // 155 per 100g
        proteinG: 12.6,      // 12.6 per 100g (corrected from 13.0)
        carbsG: 0.8,         // 0.8 per 100g (corrected from 1.1)
        fatG: 11.3,          // 11.3 per 100g (corrected from 11.0)
      }
    },
  ];

  validatedCases.forEach(testCase => {
    it(`should calculate accurate macros for ${testCase.name} (within 1% error)`, async () => {
      const result = await engine.computeItemMacros(testCase.foodId, testCase.portion);

      // Validate each macro is within 1% error tolerance
      const caloriesError = Math.abs(result.caloriesKcal - testCase.expected.caloriesKcal) / testCase.expected.caloriesKcal;
      const proteinError = Math.abs(result.proteinG - testCase.expected.proteinG) / testCase.expected.proteinG;
      const carbsError = testCase.expected.carbsG > 0 ? Math.abs(result.carbsG - testCase.expected.carbsG) / testCase.expected.carbsG : 0;
      const fatError = Math.abs(result.fatG - testCase.expected.fatG) / testCase.expected.fatG;

      expect(caloriesError).toBeLessThan(0.01); // < 1% error
      expect(proteinError).toBeLessThan(0.01);   // < 1% error
      expect(carbsError).toBeLessThan(0.01);     // < 1% error
      expect(fatError).toBeLessThan(0.01);       // < 1% error

      // Log the actual vs expected for debugging
      console.log(`${testCase.name} accuracy test:`);
      console.log(`  Calories: ${result.caloriesKcal.toFixed(2)} (expected ${testCase.expected.caloriesKcal}) - ${(caloriesError * 100).toFixed(3)}% error`);
      console.log(`  Protein: ${result.proteinG.toFixed(2)}g (expected ${testCase.expected.proteinG}g) - ${(proteinError * 100).toFixed(3)}% error`);
      console.log(`  Carbs: ${result.carbsG.toFixed(2)}g (expected ${testCase.expected.carbsG}g) - ${(carbsError * 100).toFixed(3)}% error`);
      console.log(`  Fat: ${result.fatG.toFixed(2)}g (expected ${testCase.expected.fatG}g) - ${(fatError * 100).toFixed(3)}% error`);
    });
  });

  it("should calculate meal macros accurately", async () => {
    const mealItems = [
      { foodId: "oats_rolled", portion: { quantity: 50, unit: "g" } },
      { foodId: "milk_skim", portion: { quantity: 240, unit: "ml" } },
      { foodId: "banana_raw", portion: { quantity: 120, unit: "g" } },
    ];

    const mealMacros = await engine.computeMealMacros(mealItems);
    
    // Calculate expected totals by summing individual items
    const individual1 = await engine.computeItemMacros("oats_rolled", { quantity: 50, unit: "g" });
    const individual2 = await engine.computeItemMacros("milk_skim", { quantity: 240, unit: "ml" });
    const individual3 = await engine.computeItemMacros("banana_raw", { quantity: 120, unit: "g" });
    
    const expectedTotal = {
      caloriesKcal: individual1.caloriesKcal + individual2.caloriesKcal + individual3.caloriesKcal,
      proteinG: individual1.proteinG + individual2.proteinG + individual3.proteinG,
      carbsG: individual1.carbsG + individual2.carbsG + individual3.carbsG,
      fatG: individual1.fatG + individual2.fatG + individual3.fatG,
    };

    // Meal calculation should exactly match sum of individual calculations
    expect(mealMacros.caloriesKcal).toBeCloseTo(expectedTotal.caloriesKcal, 5);
    expect(mealMacros.proteinG).toBeCloseTo(expectedTotal.proteinG, 5);
    expect(mealMacros.carbsG).toBeCloseTo(expectedTotal.carbsG, 5);
    expect(mealMacros.fatG).toBeCloseTo(expectedTotal.fatG, 5);
  });

  it("should handle edge cases accurately", async () => {
    // Test very small portions
    const smallPortion = await engine.computeItemMacros("oats_rolled", { quantity: 1, unit: "g" });
    expect(smallPortion.caloriesKcal).toBeCloseTo(3.89, 2); // 389/100

    // Test large portions
    const largePortion = await engine.computeItemMacros("oats_rolled", { quantity: 1000, unit: "g" });
    expect(largePortion.caloriesKcal).toBeCloseTo(3890, 1); // 389*10
  });

  it("should maintain precision across unit conversions", async () => {
    // Test ml to g conversion accuracy for milk (density = 1.035 g/ml)
    const milk100ml = await engine.computeItemMacros("milk_skim", { quantity: 100, unit: "ml" });
    const milk103g = await engine.computeItemMacros("milk_skim", { quantity: 103.5, unit: "g" }); // 100ml * 1.035 density
    
    // These should be very close (within 0.5% due to rounding)
    const caloriesDiff = Math.abs(milk100ml.caloriesKcal - milk103g.caloriesKcal) / milk103g.caloriesKcal;
    expect(caloriesDiff).toBeLessThan(0.005); // < 0.5% difference - very good accuracy
  });
});