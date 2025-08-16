import { describe, it, expect, beforeAll } from "vitest";
import { UsdaFdcClient } from "./usdaFdcClient";

describe("USDA FDC Client", () => {
  let client: UsdaFdcClient;

  beforeAll(() => {
    // Use a dummy API key for testing - tests should mock the API calls
    client = new UsdaFdcClient("DEMO_KEY");
  });

  it("should create client with API key", () => {
    expect(client).toBeDefined();
  });

  it("should have testConnection method", () => {
    expect(typeof client.testConnection).toBe("function");
  });

  it("should have search method", () => {
    expect(typeof client.search).toBe("function");
  });

  it("should have getFood method", () => {
    expect(typeof client.getFood).toBe("function");
  });

  it("should have convertToFoodItem method", () => {
    expect(typeof client.convertToFoodItem).toBe("function");
  });

  it("should convert FDC food data to FoodItem format", () => {
    const mockFdcFood = {
      fdcId: 123456,
      description: "Apple, raw",
      dataType: "SR Legacy",
      foodNutrients: [
        { nutrientId: 1008, nutrientName: "Energy", unitName: "kcal", value: 52 },
        { nutrientId: 1003, nutrientName: "Protein", unitName: "g", value: 0.26 },
        { nutrientId: 1005, nutrientName: "Carbohydrate, by difference", unitName: "g", value: 13.81 },
        { nutrientId: 1004, nutrientName: "Total lipid (fat)", unitName: "g", value: 0.17 },
        { nutrientId: 1079, nutrientName: "Fiber, total dietary", unitName: "g", value: 2.4 },
        { nutrientId: 2000, nutrientName: "Sugars, total including NLEA", unitName: "g", value: 10.39 },
      ],
    };

    const foodItem = client.convertToFoodItem(mockFdcFood);

    expect(foodItem.id).toBe("usda_123456");
    expect(foodItem.name).toBe("Apple, raw");
    expect(foodItem.basePortion).toEqual({ quantity: 100, unit: "g" });
    expect(foodItem.macrosPerBase.caloriesKcal).toBe(52);
    expect(foodItem.macrosPerBase.proteinG).toBe(0.26);
    expect(foodItem.macrosPerBase.carbsG).toBe(13.81);
    expect(foodItem.macrosPerBase.fatG).toBe(0.17);
    expect(foodItem.macrosPerBase.fiberG).toBe(2.4);
    expect(foodItem.macrosPerBase.sugarG).toBe(10.39);
    expect(foodItem.metadata?.source).toBe("usda_fdc");
    expect(foodItem.metadata?.confidence).toBe(0.95);
  });

  it("should handle missing nutrients gracefully", () => {
    const mockFdcFood = {
      fdcId: 123456,
      description: "Test Food",
      dataType: "SR Legacy",
      foodNutrients: [
        { nutrientId: 1008, nutrientName: "Energy", unitName: "kcal", value: 100 },
      ],
    };

    const foodItem = client.convertToFoodItem(mockFdcFood);

    expect(foodItem.macrosPerBase.caloriesKcal).toBe(100);
    expect(foodItem.macrosPerBase.proteinG).toBe(0);
    expect(foodItem.macrosPerBase.carbsG).toBe(0);
    expect(foodItem.macrosPerBase.fatG).toBe(0);
    expect(foodItem.macrosPerBase.fiberG).toBeUndefined();
    expect(foodItem.macrosPerBase.sugarG).toBeUndefined();
  });

  // Note: Real API tests would require actual API key and network calls
  // These would be integration tests rather than unit tests
});