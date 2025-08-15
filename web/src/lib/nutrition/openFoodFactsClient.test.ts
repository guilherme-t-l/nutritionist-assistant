import { describe, it, expect, beforeAll } from "vitest";
import { OpenFoodFactsClient } from "./openFoodFactsClient";

describe("Open Food Facts Client", () => {
  let client: OpenFoodFactsClient;

  beforeAll(() => {
    client = new OpenFoodFactsClient();
  });

  it("should test API connectivity", async () => {
    const isConnected = await client.testConnection();
    expect(isConnected).toBe(true);
  }, 10000); // 10 second timeout for API call

  it("should search for foods", async () => {
    const results = await client.searchFoods("chicken", 1, 5);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty("product_name");
    expect(results[0]).toHaveProperty("nutriments");
  }, 15000);

  it("should get food by barcode", async () => {
    // Test with Nutella barcode (known product)
    const product = await client.getFoodByBarcode("3017620422003");
    expect(product).not.toBeNull();
    if (product) {
      expect(product.product_name).toContain("Nutella");
      expect(product.nutriments).toBeDefined();
    }
  }, 15000);

  it("should convert product to FoodItem format", async () => {
    const results = await client.searchFoods("apple", 1, 1);
    if (results.length > 0) {
      const foodItem = client.convertToFoodItem(results[0]);
      expect(foodItem.id).toMatch(/^off_/);
      expect(foodItem.name).toBeDefined();
      expect(foodItem.macrosPerBase.caloriesKcal).toBeGreaterThan(0);
      expect(foodItem.metadata?.source).toBe('open_food_facts');
    }
  }, 15000);

  it("should handle API errors gracefully", async () => {
    // Test with invalid barcode
    const product = await client.getFoodByBarcode("invalid_barcode");
    expect(product).toBeNull();
  });

  it("should validate macro values", async () => {
    const results = await client.searchFoods("milk", 1, 1);
    if (results.length > 0) {
      const foodItem = client.convertToFoodItem(results[0]);
      
      // Check that macros are reasonable
      expect(foodItem.macrosPerBase.proteinG).toBeGreaterThanOrEqual(0);
      expect(foodItem.macrosPerBase.carbsG).toBeGreaterThanOrEqual(0);
      expect(foodItem.macrosPerBase.fatG).toBeGreaterThanOrEqual(0);
      expect(foodItem.macrosPerBase.caloriesKcal).toBeGreaterThan(0);
    }
  }, 15000);

  it("should search by category", async () => {
    const results = await client.getFoodsByCategory("fruits", 1, 5);
    expect(results.length).toBeGreaterThan(0);
    
    // Check that results contain fruit-related items
    const hasFruit = results.some(product => 
      product.product_name.toLowerCase().includes("fruit") ||
      product.product_name.toLowerCase().includes("apple") ||
      product.product_name.toLowerCase().includes("banana")
    );
    expect(hasFruit).toBe(true);
  }, 15000);
});
