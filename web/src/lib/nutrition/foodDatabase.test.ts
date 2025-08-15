import { describe, it, expect } from "vitest";
import { FOOD_DATABASE, getFoodById, searchFoods, getFoodsByCategory, DATABASE_SIZE } from "./foodDatabase";
import { MacroEngine } from "./macroEngine";
import { PIECE_MAP } from "./fixtures";

describe("Food Database", () => {
  it("should have a substantial number of foods", () => {
    expect(DATABASE_SIZE).toBeGreaterThan(75);
    console.log(`Database contains ${DATABASE_SIZE} foods`);
  });

  it("should have foods from all major categories", () => {
    const categories = getFoodsByCategory("proteins");
    expect(categories.length).toBeGreaterThan(10);
    
    const grains = getFoodsByCategory("grains");
    expect(grains.length).toBeGreaterThan(5);
    
    const vegetables = getFoodsByCategory("vegetables");
    expect(vegetables.length).toBeGreaterThan(8);
  });

  it("should find foods by ID", () => {
    const chicken = getFoodById("chicken_breast_cooked");
    expect(chicken).toBeDefined();
    expect(chicken?.name).toBe("Chicken Breast, cooked");
    expect(chicken?.macrosPerBase.proteinG).toBe(31.0);
  });

  it("should search foods by name", () => {
    const results = searchFoods("chicken");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(f => f.name.toLowerCase().includes("chicken"))).toBe(true);
  });

  it("should have accurate macro data", () => {
    const oats = getFoodById("oats_rolled");
    expect(oats?.macrosPerBase.caloriesKcal).toBe(389);
    expect(oats?.macrosPerBase.proteinG).toBe(16.9);
    expect(oats?.macrosPerBase.carbsG).toBe(66.3);
    expect(oats?.macrosPerBase.fatG).toBe(6.9);
  });

  it("should work with macro engine", () => {
    const engine = new MacroEngine(FOOD_DATABASE, { pieceToGramMap: PIECE_MAP });
    
    // Test a simple calculation
    const macros = engine.computeItemMacros("chicken_breast_cooked", { quantity: 150, unit: "g" });
    expect(macros.caloriesKcal).toBeCloseTo(247.5, 1); // 165 * 1.5
    expect(macros.proteinG).toBeCloseTo(46.5, 1); // 31 * 1.5
  });

  it("should handle different units correctly", () => {
    const engine = new MacroEngine(FOOD_DATABASE, { pieceToGramMap: PIECE_MAP });
    
    // Test piece-based calculation
    const macros = engine.computeItemMacros("egg_whole", { quantity: 2, unit: "piece" });
    expect(macros.caloriesKcal).toBeCloseTo(155, 1); // 2 * 50g * (155/100)
  });

  it("should have consistent base portions", () => {
    // All foods should have basePortion of 100g or 100ml
    FOOD_DATABASE.forEach(food => {
      expect([100, 100]).toContain(food.basePortion.quantity);
      expect(["g", "ml"]).toContain(food.basePortion.unit);
    });
  });

  it("should have valid macro values", () => {
    FOOD_DATABASE.forEach(food => {
      const macros = food.macrosPerBase;
      
      // Calories should be positive and reasonable
      expect(macros.caloriesKcal).toBeGreaterThan(0);
      expect(macros.caloriesKcal).toBeLessThan(1000);
      
      // Macros should be non-negative
      expect(macros.proteinG).toBeGreaterThanOrEqual(0);
      expect(macros.carbsG).toBeGreaterThanOrEqual(0);
      expect(macros.fatG).toBeGreaterThanOrEqual(0);
      
      // Optional macros should be non-negative if present
      if (macros.fiberG !== undefined) expect(macros.fiberG).toBeGreaterThanOrEqual(0);
      if (macros.sugarG !== undefined) expect(macros.sugarG).toBeGreaterThanOrEqual(0);
    });
  });

  it("should have unique IDs", () => {
    const ids = FOOD_DATABASE.map(f => f.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("should have meaningful names", () => {
    FOOD_DATABASE.forEach(food => {
      expect(food.name.length).toBeGreaterThan(0);
      expect(food.name).toMatch(/^[A-Za-z\s,()-]+$/); // Basic name validation
    });
  });
});
