import type { FoodItem } from "./types";

// USDA FoodData Central Nutrient IDs
const USDA_NUTRIENT_IDS = {
  ENERGY_KCAL: 1008,     // Energy (kcal)
  PROTEIN: 1003,         // Protein (g)
  CARBOHYDRATE: 1005,    // Carbohydrate, by difference (g)
  TOTAL_FAT: 1004,       // Total fat (g)
  FIBER: 1079,           // Fiber, total dietary (g)
  SUGARS: 2000,          // Sugars, total including NLEA (g)
} as const;

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
   * Convert USDA FDC food to our FoodItem format
   */
  convertToFoodItem(fdcFood: FdcFoodDetail): FoodItem {
    // Create a map of nutrient ID to value for easier lookup
    const nutrientMap = new Map<number, number>();
    fdcFood.foodNutrients.forEach(nutrient => {
      if (nutrient.value && nutrient.value > 0) {
        nutrientMap.set(nutrient.nutrientId, nutrient.value);
      }
    });

    // Extract macro values using USDA nutrient IDs
    const calories = this.validateMacroValue(nutrientMap.get(USDA_NUTRIENT_IDS.ENERGY_KCAL), 'calories');
    const protein = this.validateMacroValue(nutrientMap.get(USDA_NUTRIENT_IDS.PROTEIN), 'protein');
    const carbs = this.validateMacroValue(nutrientMap.get(USDA_NUTRIENT_IDS.CARBOHYDRATE), 'carbs');
    const fat = this.validateMacroValue(nutrientMap.get(USDA_NUTRIENT_IDS.TOTAL_FAT), 'fat');
    const fiber = this.validateMacroValue(nutrientMap.get(USDA_NUTRIENT_IDS.FIBER), 'fiber');
    const sugar = this.validateMacroValue(nutrientMap.get(USDA_NUTRIENT_IDS.SUGARS), 'sugar');

    return {
      id: `usda_${fdcFood.fdcId}`,
      name: fdcFood.description,
      basePortion: { quantity: 100, unit: "g" },
      macrosPerBase: {
        caloriesKcal: calories,
        proteinG: protein,
        carbsG: carbs,
        fatG: fat,
        fiberG: fiber > 0 ? fiber : undefined,
        sugarG: sugar > 0 ? sugar : undefined,
      },
      metadata: {
        source: 'usda_fdc',
        lastUpdated: new Date(),
        confidence: 0.95, // USDA data is highly reliable
      },
    };
  }

  /**
   * Validate macro values and apply reasonable limits
   */
  private validateMacroValue(value: number | undefined, macroType: string): number {
    if (value === undefined || value === null) {
      return 0;
    }

    // Convert to number if it's a string
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    
    if (isNaN(numValue) || numValue < 0) {
      return 0;
    }

    // Apply reasonable upper limits based on macro type
    const maxValues: Record<string, number> = {
      calories: 900,  // Max 900 kcal per 100g (very high energy foods like oils)
      protein: 50,    // Max 50g protein per 100g (very high protein foods)
      carbs: 100,     // Max 100g carbs per 100g (pure sugar/carbs)
      fat: 100,       // Max 100g fat per 100g (pure oils)
      fiber: 50,      // Max 50g fiber per 100g (very high fiber foods)
      sugar: 100,     // Max 100g sugar per 100g (pure sugar)
    };

    const maxValue = maxValues[macroType] || 100;
    return Math.min(numValue, maxValue);
  }

  /**
   * Test the API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      // Try a simple search to test connection
      await this.search("apple", 1);
      return true;
    } catch (error) {
      console.error('USDA FDC connection test failed:', error);
      return false;
    }
  }
}