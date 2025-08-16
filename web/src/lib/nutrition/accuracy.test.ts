import { describe, it, expect } from "vitest";
import { MacroEngine } from "./macroEngine";
import { FOOD_DATABASE } from "./foodDatabase";
import { PIECE_MAP } from "./fixtures";

describe("Nutrition Accuracy Validation", () => {
  const engine = new MacroEngine(FOOD_DATABASE, { pieceToGramMap: PIECE_MAP });

  describe("Macro Calculation Accuracy (<1% error requirement)", () => {
    const validatedFoods = [
      {
        id: "chicken_breast_cooked",
        expectedPer100g: { calories: 165, protein: 31.0, carbs: 0, fat: 3.6 },
        portions: [
          { quantity: 150, unit: "g", expectedCalories: 247.5, expectedProtein: 46.5 },
          { quantity: 200, unit: "g", expectedCalories: 330, expectedProtein: 62.0 },
        ]
      },
      {
        id: "oats_rolled",
        expectedPer100g: { calories: 389, protein: 16.9, carbs: 66.3, fat: 6.9 },
        portions: [
          { quantity: 50, unit: "g", expectedCalories: 194.5, expectedProtein: 8.45 },
          { quantity: 80, unit: "g", expectedCalories: 311.2, expectedProtein: 13.52 },
        ]
      },
      {
        id: "banana_raw",
        expectedPer100g: { calories: 89, protein: 1.1, carbs: 22.8, fat: 0.3 },
        portions: [
          { quantity: 120, unit: "g", expectedCalories: 106.8, expectedProtein: 1.32 },
          { quantity: 150, unit: "g", expectedCalories: 133.5, expectedProtein: 1.65 },
        ]
      },
      {
        id: "milk_skim",
        expectedPer100g: { calories: 34, protein: 3.4, carbs: 5.0, fat: 0.1 },
        portions: [
          { quantity: 240, unit: "ml", expectedCalories: 81.6, expectedProtein: 8.16 },
          { quantity: 500, unit: "ml", expectedCalories: 170, expectedProtein: 17.0 },
        ]
      }
    ];

    validatedFoods.forEach(food => {
      describe(`${food.id} accuracy`, () => {
        it("should match expected base nutrition values", async () => {
          // Use the correct base unit for each food (most use g, but milk uses ml)
          const baseUnit = food.id === "milk_skim" ? "ml" : "g";
          const macros = await engine.computeItemMacros(food.id, { quantity: 100, unit: baseUnit });
          
          const calorieError = Math.abs(macros.caloriesKcal - food.expectedPer100g.calories) / food.expectedPer100g.calories;
          const proteinError = Math.abs(macros.proteinG - food.expectedPer100g.protein) / food.expectedPer100g.protein;
          const carbError = Math.abs(macros.carbsG - food.expectedPer100g.carbs) / Math.max(food.expectedPer100g.carbs, 1);
          const fatError = Math.abs(macros.fatG - food.expectedPer100g.fat) / Math.max(food.expectedPer100g.fat, 1);

          expect(calorieError).toBeLessThan(0.01); // <1% error
          expect(proteinError).toBeLessThan(0.01); // <1% error
          expect(carbError).toBeLessThan(0.01); // <1% error
          expect(fatError).toBeLessThan(0.01); // <1% error
        });

        food.portions.forEach((portion, index) => {
          it(`should accurately scale for portion ${index + 1} (${portion.quantity}${portion.unit})`, async () => {
            const macros = await engine.computeItemMacros(food.id, { 
              quantity: portion.quantity, 
              unit: portion.unit 
            });
            
            const calorieError = Math.abs(macros.caloriesKcal - portion.expectedCalories) / portion.expectedCalories;
            const proteinError = Math.abs(macros.proteinG - portion.expectedProtein) / portion.expectedProtein;

            expect(calorieError).toBeLessThan(0.01); // <1% error
            expect(proteinError).toBeLessThan(0.01); // <1% error
          });
        });
      });
    });

    it("should handle piece-based calculations accurately", async () => {
      const eggMacros = await engine.computeItemMacros("egg_whole", { quantity: 1, unit: "piece" });
      const egg50gMacros = await engine.computeItemMacros("egg_whole", { quantity: 50, unit: "g" });
      
      // Should be identical since 1 piece = 50g according to PIECE_MAP
      const calorieError = Math.abs(eggMacros.caloriesKcal - egg50gMacros.caloriesKcal) / egg50gMacros.caloriesKcal;
      const proteinError = Math.abs(eggMacros.proteinG - egg50gMacros.proteinG) / egg50gMacros.proteinG;
      
      expect(calorieError).toBeLessThan(0.001); // <0.1% error for piece conversion
      expect(proteinError).toBeLessThan(0.001); // <0.1% error for piece conversion
    });

    it("should handle volume-to-mass conversions accurately", async () => {
      // Milk has density of ~1.03 g/ml
      const milk240ml = await engine.computeItemMacros("milk_skim", { quantity: 240, unit: "ml" });
      const milk247g = await engine.computeItemMacros("milk_skim", { quantity: 247, unit: "g" }); // 240ml * 1.03
      
      // Should be very close (within density conversion accuracy)
      const calorieError = Math.abs(milk240ml.caloriesKcal - milk247g.caloriesKcal) / milk247g.caloriesKcal;
      expect(calorieError).toBeLessThan(0.05); // <5% error for density conversions
    });
  });

  describe("Meal Aggregation Accuracy", () => {
    it("should accurately sum meal macros", async () => {
      const mealItems = [
        { foodId: "chicken_breast_cooked", portion: { quantity: 150, unit: "g" } },
        { foodId: "brown_rice_cooked", portion: { quantity: 100, unit: "g" } },
        { foodId: "broccoli_raw", portion: { quantity: 80, unit: "g" } },
      ];

      const mealMacros = await engine.computeMealMacros(mealItems);
      
      // Calculate expected totals manually
      const chickenMacros = await engine.computeItemMacros("chicken_breast_cooked", { quantity: 150, unit: "g" });
      const riceMacros = await engine.computeItemMacros("brown_rice_cooked", { quantity: 100, unit: "g" });
      const broccoliMacros = await engine.computeItemMacros("broccoli_raw", { quantity: 80, unit: "g" });
      
      const expectedCalories = chickenMacros.caloriesKcal + riceMacros.caloriesKcal + broccoliMacros.caloriesKcal;
      const expectedProtein = chickenMacros.proteinG + riceMacros.proteinG + broccoliMacros.proteinG;
      
      const calorieError = Math.abs(mealMacros.caloriesKcal - expectedCalories) / expectedCalories;
      const proteinError = Math.abs(mealMacros.proteinG - expectedProtein) / expectedProtein;
      
      expect(calorieError).toBeLessThan(0.001); // Aggregation should be exact
      expect(proteinError).toBeLessThan(0.001); // Aggregation should be exact
    });

    it("should accurately aggregate daily nutrition", async () => {
      const dayMeals = [
        [
          { foodId: "oats_rolled", portion: { quantity: 50, unit: "g" } },
          { foodId: "milk_skim", portion: { quantity: 240, unit: "ml" } },
        ],
        [
          { foodId: "chicken_breast_cooked", portion: { quantity: 150, unit: "g" } },
          { foodId: "brown_rice_cooked", portion: { quantity: 100, unit: "g" } },
        ],
        [
          { foodId: "salmon_cooked", portion: { quantity: 120, unit: "g" } },
          { foodId: "sweet_potato_baked", portion: { quantity: 150, unit: "g" } },
        ]
      ];

      const dayMacros = await engine.computeDayMacros(dayMeals);
      
      // Calculate expected totals
      const meal1 = await engine.computeMealMacros(dayMeals[0]);
      const meal2 = await engine.computeMealMacros(dayMeals[1]);
      const meal3 = await engine.computeMealMacros(dayMeals[2]);
      
      const expectedTotal = meal1.caloriesKcal + meal2.caloriesKcal + meal3.caloriesKcal;
      
      const error = Math.abs(dayMacros.total.caloriesKcal - expectedTotal) / expectedTotal;
      expect(error).toBeLessThan(0.001); // Day aggregation should be exact
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle zero quantities gracefully", async () => {
      const macros = await engine.computeItemMacros("chicken_breast_cooked", { quantity: 0, unit: "g" });
      
      expect(macros.caloriesKcal).toBe(0);
      expect(macros.proteinG).toBe(0);
      expect(macros.carbsG).toBe(0);
      expect(macros.fatG).toBe(0);
    });

    it("should handle unknown foods gracefully", async () => {
      const macros = await engine.computeItemMacros("nonexistent_food", { quantity: 100, unit: "g" });
      
      expect(macros.caloriesKcal).toBe(0);
      expect(macros.proteinG).toBe(0);
      expect(macros.carbsG).toBe(0);
      expect(macros.fatG).toBe(0);
    });

    it("should handle very small quantities accurately", async () => {
      const macros = await engine.computeItemMacros("chicken_breast_cooked", { quantity: 0.1, unit: "g" });
      
      // Should be proportional (0.1g = 0.001 of 100g)
      expect(macros.caloriesKcal).toBeCloseTo(0.165, 3); // 165 * 0.001
      expect(macros.proteinG).toBeCloseTo(0.031, 3); // 31 * 0.001
    });

    it("should handle very large quantities accurately", async () => {
      const macros = await engine.computeItemMacros("chicken_breast_cooked", { quantity: 10000, unit: "g" });
      
      // Should be proportional (10kg = 100x of 100g)
      expect(macros.caloriesKcal).toBeCloseTo(16500, 1); // 165 * 100
      expect(macros.proteinG).toBeCloseTo(3100, 1); // 31 * 100
    });
  });

  describe("Performance Requirements", () => {
    it("should calculate individual item macros quickly", async () => {
      const start = performance.now();
      
      for (let i = 0; i < 100; i++) {
        await engine.computeItemMacros("chicken_breast_cooked", { quantity: 100, unit: "g" });
      }
      
      const end = performance.now();
      const avgTime = (end - start) / 100;
      
      expect(avgTime).toBeLessThan(1); // Should average < 1ms per calculation
    });

    it("should calculate meal macros efficiently", async () => {
      const mealItems = [
        { foodId: "chicken_breast_cooked", portion: { quantity: 150, unit: "g" } },
        { foodId: "brown_rice_cooked", portion: { quantity: 100, unit: "g" } },
        { foodId: "broccoli_raw", portion: { quantity: 80, unit: "g" } },
        { foodId: "olive_oil", portion: { quantity: 15, unit: "g" } },
        { foodId: "avocado_raw", portion: { quantity: 50, unit: "g" } },
      ];

      const start = performance.now();
      
      for (let i = 0; i < 20; i++) {
        await engine.computeMealMacros(mealItems);
      }
      
      const end = performance.now();
      const avgTime = (end - start) / 20;
      
      expect(avgTime).toBeLessThan(10); // Should average < 10ms per meal calculation
    });
  });
});
