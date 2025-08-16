import type { FoodItem } from "./types";

export interface FdcSearchResult {
  fdcId: number;
  description: string;
  brandOwner?: string;
}

export interface FdcNutrient {
  nutrientId: number;
  nutrientName: string;
  unitName: string;
  value: number;
}

export interface FdcFoodDetail {
  fdcId: number;
  description: string;
  dataType: string;
  foodNutrients: FdcNutrient[];
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
}

export class UsdaFdcClient {
  private apiKey: string;
  private baseUrl: string = "https://api.nal.usda.gov/fdc";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async search(query: string, pageSize: number = 10): Promise<FdcSearchResult[]> {
    const url = new URL(`${this.baseUrl}/v1/foods/search`);
    url.searchParams.set("api_key", this.apiKey);
    url.searchParams.set("query", query);
    url.searchParams.set("pageSize", String(pageSize));
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`FDC search failed: ${res.status}`);
    const json = await res.json();
    return (json.foods ?? []).map((f: any) => ({
      fdcId: f.fdcId,
      description: f.description,
      brandOwner: f.brandOwner,
    }));
  }

  async getFood(fdcId: number): Promise<FdcFoodDetail> {
    const url = new URL(`${this.baseUrl}/v1/food/${fdcId}`);
    url.searchParams.set("api_key", this.apiKey);
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`FDC getFood failed: ${res.status}`);
    const json = await res.json();
    return json as FdcFoodDetail;
  }

  /**
   * Convert USDA FDC food detail to our FoodItem format
   */
  convertToFoodItem(fdcFood: FdcFoodDetail): FoodItem {
    // Extract key nutrients from the nutrients array
    const nutrients = fdcFood.foodNutrients.reduce((acc, nutrient) => {
      const name = nutrient.nutrientName.toLowerCase();
      if (name.includes('energy') || name.includes('calorie')) {
        acc.calories = nutrient.value;
      } else if (name.includes('protein')) {
        acc.protein = nutrient.value;
      } else if (name.includes('carbohydrate') && !name.includes('fiber')) {
        acc.carbs = nutrient.value;
      } else if (name.includes('total lipid') || name.includes('fat')) {
        acc.fat = nutrient.value;
      } else if (name.includes('fiber')) {
        acc.fiber = nutrient.value;
      } else if (name.includes('sugar')) {
        acc.sugar = nutrient.value;
      }
      return acc;
    }, {} as any);

    return {
      id: `usda_${fdcFood.fdcId}`,
      name: fdcFood.description,
      basePortion: { quantity: 100, unit: "g" },
      macrosPerBase: {
        caloriesKcal: nutrients.calories || 0,
        proteinG: nutrients.protein || 0,
        carbsG: nutrients.carbs || 0,
        fatG: nutrients.fat || 0,
        fiberG: nutrients.fiber,
        sugarG: nutrients.sugar,
      },
      metadata: {
        source: 'usda_fdc' as const,
        lastUpdated: new Date(),
        confidence: 0.95, // USDA data is highly reliable
      },
    };
  }

  /**
   * Test connection to USDA FDC API
   */
  async testConnection(): Promise<boolean> {
    try {
      // Try a simple search to test connectivity
      await this.search("apple", 1);
      return true;
    } catch (error) {
      console.warn('USDA FDC connection test failed:', error);
      return false;
    }
  }
}

