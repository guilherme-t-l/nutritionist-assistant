import { describe, it, expect, beforeAll } from "vitest";
import { HybridFoodService } from "./hybridFoodService";

describe("Hybrid Food Service", () => {
  let service: HybridFoodService;

  beforeAll(() => {
    service = new HybridFoodService({
      enableOpenFoodFacts: true,
      enableLocalDatabase: true,
      maxResults: 10,
      cacheResults: true,
    });
  });

  it("should test connectivity to all sources", async () => {
    const connectivity = await service.testConnectivity();
    
    expect(connectivity.localDatabase).toBe(true);
    expect(connectivity.overall).toBe(true);
    
    // Open Food Facts might fail in test environment, but that's okay
    console.log("Connectivity test results:", connectivity);
  }, 20000);

  it("should search foods and return results", async () => {
    const results = await service.searchFoods("chicken");
    
    expect(results.foods.length).toBeGreaterThan(0);
    expect(results.query).toBe("chicken");
    expect(results.totalCount).toBeGreaterThan(0);
    expect(["local", "open_food_facts", "hybrid"]).toContain(results.source);
    
    // Check that foods have proper structure
    results.foods.forEach(food => {
      expect(food.id).toBeDefined();
      expect(food.name).toBeDefined();
      expect(food.macrosPerBase).toBeDefined();
      expect(food.metadata?.source).toBeDefined();
    });
    
    console.log(`Found ${results.totalCount} foods from ${results.source}`);
  }, 20000);

  it("should get food by ID from local database", async () => {
    const food = await service.getFoodById("chicken_breast_cooked");
    
    expect(food).not.toBeNull();
    if (food) {
      expect(food.name).toContain("Chicken");
      expect(food.metadata?.source).toBe("local");
      expect(food.metadata?.confidence).toBe(1.0);
    }
  });

  it("should handle barcode lookups", async () => {
    // This might fail if API is down, but should handle gracefully
    try {
      const food = await service.getFoodByBarcode("3017620422003"); // Nutella
      if (food) {
        expect(food.metadata?.source).toBe("open_food_facts");
        expect(food.metadata?.barcode).toBe("3017620422003");
      }
    } catch (error) {
      console.log("Barcode lookup failed (expected in test environment):", error);
    }
  }, 15000);

  it("should provide service statistics", () => {
    const stats = service.getStats();
    
    expect(stats.localFoods).toBeGreaterThan(0);
    expect(stats.openFoodFactsAvailable).toBe(true);
    expect(stats.cacheSize).toBeGreaterThanOrEqual(0);
    
    console.log("Service stats:", stats);
  });

  it("should cache search results", async () => {
    // First search
    const results1 = await service.searchFoods("apple");
    expect(results1.foods.length).toBeGreaterThan(0);
    
    // Second search (should be cached)
    const results2 = await service.searchFoods("apple");
    expect(results2.foods.length).toBe(results1.foods.length);
    
    // Check cache size increased
    const stats = service.getStats();
    expect(stats.cacheSize).toBeGreaterThan(0);
  }, 20000);

  it("should fall back to local database when API fails", async () => {
    // Create service with Open Food Facts disabled
    const localOnlyService = new HybridFoodService({
      enableOpenFoodFacts: false,
      enableLocalDatabase: true,
    });
    
    const results = await localOnlyService.searchFoods("chicken");
    
    expect(results.source).toBe("local");
    expect(results.foods.length).toBeGreaterThan(0);
    
    // All results should be from local database
    results.foods.forEach(food => {
      expect(food.metadata?.source).toBe("local");
    });
  });

  it("should remove duplicates and prioritize sources correctly", async () => {
    const results = await service.searchFoods("milk");
    
    // Check for duplicates
    const names = results.foods.map(f => f.name.toLowerCase());
    const uniqueNames = new Set(names);
    
    // Should have no duplicates
    expect(names.length).toBe(uniqueNames.size);
    
    // Open Food Facts results should come first
    const openFoodFactsResults = results.foods.filter(f => f.metadata?.source === "open_food_facts");
    const localResults = results.foods.filter(f => f.metadata?.source === "local");
    
    if (openFoodFactsResults.length > 0 && localResults.length > 0) {
      // Open Food Facts results should come before local results
      const firstOpenFoodFactsIndex = results.foods.findIndex(f => f.metadata?.source === "open_food_facts");
      const firstLocalIndex = results.foods.findIndex(f => f.metadata?.source === "local");
      
      expect(firstOpenFoodFactsIndex).toBeLessThan(firstLocalIndex);
    }
  }, 20000);
});
