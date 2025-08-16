import { describe, it, expect } from "vitest";
import { MacroEngine } from "./macroEngine";
import { FOOD_DATABASE } from "./foodDatabase";
import { PIECE_MAP } from "./fixtures";

describe("Macro Engine Performance", () => {
  const engine = new MacroEngine(FOOD_DATABASE, { pieceToGramMap: PIECE_MAP });

  it("should calculate single item macros quickly", async () => {
    const startTime = performance.now();
    
    // Perform 100 macro calculations
    const promises = [];
    for (let i = 0; i < 100; i++) {
      promises.push(engine.computeItemMacros("chicken_breast_cooked", { quantity: 150, unit: "g" }));
    }
    
    await Promise.all(promises);
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const averageTime = totalTime / 100;

    console.log(`100 single item calculations took ${totalTime.toFixed(2)}ms (avg: ${averageTime.toFixed(2)}ms per calculation)`);
    
    // Should average less than 1ms per calculation
    expect(averageTime).toBeLessThan(1);
  });

  it("should calculate meal macros efficiently", async () => {
    const mealItems = [
      { foodId: "oats_rolled", portion: { quantity: 50, unit: "g" } },
      { foodId: "milk_skim", portion: { quantity: 240, unit: "ml" } },
      { foodId: "banana_raw", portion: { quantity: 120, unit: "g" } },
      { foodId: "chicken_breast_cooked", portion: { quantity: 150, unit: "g" } },
      { foodId: "brown_rice_cooked", portion: { quantity: 100, unit: "g" } },
    ];

    const startTime = performance.now();
    
    // Calculate 50 meals
    const promises = [];
    for (let i = 0; i < 50; i++) {
      promises.push(engine.computeMealMacros(mealItems));
    }
    
    await Promise.all(promises);
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const averageTime = totalTime / 50;

    console.log(`50 meal calculations (5 items each) took ${totalTime.toFixed(2)}ms (avg: ${averageTime.toFixed(2)}ms per meal)`);
    
    // Should average less than 5ms per meal calculation
    expect(averageTime).toBeLessThan(5);
  });

  it("should calculate day macros for complex meal plans", async () => {
    const dayMeals = [
      // Breakfast
      [
        { foodId: "oats_rolled", portion: { quantity: 50, unit: "g" } },
        { foodId: "milk_skim", portion: { quantity: 240, unit: "ml" } },
        { foodId: "banana_raw", portion: { quantity: 120, unit: "g" } },
      ],
      // Lunch  
      [
        { foodId: "chicken_breast_cooked", portion: { quantity: 150, unit: "g" } },
        { foodId: "brown_rice_cooked", portion: { quantity: 100, unit: "g" } },
        { foodId: "broccoli_raw", portion: { quantity: 80, unit: "g" } },
      ],
      // Dinner
      [
        { foodId: "salmon_cooked", portion: { quantity: 120, unit: "g" } },
        { foodId: "sweet_potato_baked", portion: { quantity: 150, unit: "g" } },
        { foodId: "spinach_raw", portion: { quantity: 60, unit: "g" } },
      ],
      // Snacks
      [
        { foodId: "almonds", portion: { quantity: 30, unit: "g" } },
        { foodId: "apple_raw", portion: { quantity: 150, unit: "g" } },
      ],
    ];

    const startTime = performance.now();
    
    // Calculate 20 full day meal plans
    const promises = [];
    for (let i = 0; i < 20; i++) {
      promises.push(engine.computeDayMacros(dayMeals));
    }
    
    await Promise.all(promises);
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const averageTime = totalTime / 20;

    console.log(`20 full day calculations (11 items each) took ${totalTime.toFixed(2)}ms (avg: ${averageTime.toFixed(2)}ms per day)`);
    
    // Should average less than 15ms per full day calculation
    expect(averageTime).toBeLessThan(15);
  });

  it("should handle large batch calculations efficiently", async () => {
    const startTime = performance.now();
    
    // Calculate macros for every food in the database
    const promises = FOOD_DATABASE.map(food => 
      engine.computeItemMacros(food.id, { quantity: 100, unit: "g" })
    );
    
    await Promise.all(promises);
    const endTime = performance.now();
    const totalTime = endTime - startTime;

    console.log(`${FOOD_DATABASE.length} food calculations took ${totalTime.toFixed(2)}ms (avg: ${(totalTime / FOOD_DATABASE.length).toFixed(2)}ms per food)`);
    
    // Should complete all foods in database in under 100ms
    expect(totalTime).toBeLessThan(100);
  });

  it("should handle unit conversions efficiently", async () => {
    const conversions = [
      { foodId: "milk_skim", portion: { quantity: 250, unit: "ml" } },
      { foodId: "milk_skim", portion: { quantity: 1, unit: "cup" } },
      { foodId: "milk_skim", portion: { quantity: 16, unit: "tbsp" } },
      { foodId: "oats_rolled", portion: { quantity: 1.5, unit: "oz" } },
      { foodId: "egg_whole", portion: { quantity: 3, unit: "piece" } },
    ];

    const startTime = performance.now();
    
    // Perform 100 conversion calculations
    const promises = [];
    for (let i = 0; i < 100; i++) {
      for (const conversion of conversions) {
        promises.push(engine.computeItemMacros(conversion.foodId, conversion.portion));
      }
    }
    
    await Promise.all(promises);
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const averageTime = totalTime / (100 * conversions.length);

    console.log(`${100 * conversions.length} unit conversions took ${totalTime.toFixed(2)}ms (avg: ${averageTime.toFixed(2)}ms per conversion)`);
    
    // Unit conversions should be very fast
    expect(averageTime).toBeLessThan(1);
  });
});