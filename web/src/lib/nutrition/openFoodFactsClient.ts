import type { FoodItem } from "./types";

// Open Food Facts API response types
export interface OpenFoodFactsProduct {
  code: string; // barcode
  product_name: string;
  brands?: string;
  generic_name?: string;
  nutriments: {
    energy_100g?: number; // kcal per 100g
    proteins_100g?: number;
    carbohydrates_100g?: number;
    fat_100g?: number;
    fiber_100g?: number;
    sugars_100g?: number;
    "energy-kcal_100g"?: number; // alternative energy field
  };
  image_url?: string;
  image_nutrition_url?: string;
  categories_tags?: string[];
  origins?: string;
  countries_tags?: string[];
  languages_tags?: string[];
  last_updated_t?: number;
}

export interface OpenFoodFactsSearchResult {
  count: number;
  page: number;
  page_size: number;
  products: OpenFoodFactsProduct[];
}

export interface OpenFoodFactsError {
  status: number;
  status_verbose: string;
  error?: string;
}

export class OpenFoodFactsClient {
  private baseUrl: string = "https://world.openfoodfacts.org";
  private userAgent: string = "NutritionistApp/1.0";

  /**
   * Search for foods by name/brand
   */
  async searchFoods(query: string, page: number = 1, pageSize: number = 20): Promise<OpenFoodFactsProduct[]> {
    try {
      const url = new URL(`${this.baseUrl}/cgi/search.pl`);
      url.searchParams.set("search_terms", query);
      url.searchParams.set("search_simple", "1");
      url.searchParams.set("action", "process");
      url.searchParams.set("json", "1");
      url.searchParams.set("page", page.toString());
      url.searchParams.set("page_size", pageSize.toString());
      url.searchParams.set("fields", "code,product_name,brands,generic_name,nutriments,image_url,categories_tags");

      const response = await fetch(url.toString(), {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: OpenFoodFactsSearchResult = await response.json();
      
      if (!data.products) {
        console.warn('Open Food Facts API returned no products');
        return [];
      }

      return data.products.filter(product => this.isValidProduct(product));
    } catch (error) {
      console.error('Open Food Facts search failed:', error);
      throw new Error(`Failed to search Open Food Facts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get food by barcode
   */
  async getFoodByBarcode(barcode: string): Promise<OpenFoodFactsProduct | null> {
    try {
      const url = `${this.baseUrl}/api/v0/product/${barcode}.json`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null; // Product not found
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.status === 0) {
        return null; // Product not found
      }

      if (!data.product) {
        throw new Error('Invalid response format from Open Food Facts');
      }

      return this.isValidProduct(data.product) ? data.product : null;
    } catch (error) {
      console.error('Open Food Facts barcode lookup failed:', error);
      throw new Error(`Failed to lookup barcode: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get foods by category
   */
  async getFoodsByCategory(category: string, page: number = 1, pageSize: number = 20): Promise<OpenFoodFactsProduct[]> {
    try {
      const url = new URL(`${this.baseUrl}/cgi/search.pl`);
      url.searchParams.set("categories_tags", category);
      url.searchParams.set("action", "process");
      url.searchParams.set("json", "1");
      url.searchParams.set("page", page.toString());
      url.searchParams.set("page_size", pageSize.toString());
      url.searchParams.set("fields", "code,product_name,brands,generic_name,nutriments,image_url,categories_tags");

      const response = await fetch(url.toString(), {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: OpenFoodFactsSearchResult = await response.json();
      
      if (!data.products) {
        return [];
      }

      return data.products.filter(product => this.isValidProduct(product));
    } catch (error) {
      console.error('Open Food Facts category search failed:', error);
      throw new Error(`Failed to search by category: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate that a product has sufficient nutritional data
   */
  private isValidProduct(product: OpenFoodFactsProduct): boolean {
    if (!product.product_name || !product.nutriments) {
      return false;
    }

    const nutriments = product.nutriments;
    
    // Must have at least calories and one macro
    const hasCalories = (nutriments.energy_100g !== undefined && nutriments.energy_100g > 0) ||
                       (nutriments["energy-kcal_100g"] !== undefined && nutriments["energy-kcal_100g"] > 0);
    
    const hasMacros = (nutriments.proteins_100g !== undefined && nutriments.proteins_100g >= 0) ||
                     (nutriments.carbohydrates_100g !== undefined && nutriments.carbohydrates_100g >= 0) ||
                     (nutriments.fat_100g !== undefined && nutriments.fat_100g >= 0);

    return hasCalories && hasMacros;
  }

  /**
   * Convert Open Food Facts product to our FoodItem format
   */
  convertToFoodItem(product: OpenFoodFactsProduct): FoodItem {
    const nutriments = product.nutriments;
    
    // Handle different energy field names
    const calories = nutriments["energy-kcal_100g"] || nutriments.energy_100g || 0;
    
    // Validate and sanitize macro values
    const protein = this.validateMacroValue(nutriments.proteins_100g, 'protein');
    const carbs = this.validateMacroValue(nutriments.carbohydrates_100g, 'carbs');
    const fat = this.validateMacroValue(nutriments.fat_100g, 'fat');
    const fiber = this.validateMacroValue(nutriments.fiber_100g, 'fiber');
    const sugar = this.validateMacroValue(nutriments.sugars_100g, 'sugar');

    return {
      id: `off_${product.code}`,
      name: product.product_name,
      basePortion: { quantity: 100, unit: "g" },
      macrosPerBase: {
        caloriesKcal: calories,
        proteinG: protein,
        carbsG: carbs,
        fatG: fat,
        fiberG: fiber,
        sugarG: sugar,
      },
      // Add metadata for tracking
      metadata: {
        source: 'open_food_facts',
        barcode: product.code,
        brand: product.brands,
        lastUpdated: product.last_updated_t ? new Date(product.last_updated_t * 1000) : undefined,
        imageUrl: product.image_url,
        nutritionImageUrl: product.image_nutrition_url,
        categories: product.categories_tags,
        countries: product.countries_tags,
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
      const testProduct = await this.getFoodByBarcode('3017620422003'); // Nutella barcode
      return testProduct !== null;
    } catch (error) {
      console.error('Open Food Facts API connection test failed:', error);
      return false;
    }
  }
}
