import { portionToGrams, isMassUnit, isVolumeUnit } from "./units";
import type { FoodItem, MealItemInput, AggregatedMacros } from "./types";
import { HybridFoodService } from "./hybridFoodService";

export interface MacroEngineOptions {
  /**
   * Default grams for a single piece when a food has a known per-piece weight.
   * Supplied via a mapping at call time when available.
   */
  pieceToGramMap?: Record<string, number>; // foodId -> grams per piece
  
  /**
   * Whether to use the hybrid food service for dynamic food lookups
   */
  useHybridService?: boolean;
  
  /**
   * Hybrid food service instance
   */
  hybridService?: HybridFoodService;
}

export class MacroEngine {
  private foodIndex: Map<string, FoodItem>;
  private options: MacroEngineOptions;
  private hybridService: HybridFoodService | null = null;

  constructor(foods: FoodItem[], options: MacroEngineOptions = {}) {
    this.foodIndex = new Map(foods.map((f) => [f.id, f]));
    this.options = options;
    
    if (options.useHybridService && options.hybridService) {
      this.hybridService = options.hybridService;
    }
  }

  /**
   * Get food by ID, with fallback to hybrid service if available
   */
  async getFood(foodId: string): Promise<FoodItem | undefined> {
    // Check local index first
    let food = this.foodIndex.get(foodId);
    
    if (food) {
      return food;
    }
    
    // Try hybrid service if available
    if (this.hybridService) {
      try {
        const hybridFood = await this.hybridService.getFoodById(foodId);
        if (hybridFood) {
          // Cache the food in our local index for future use
          this.foodIndex.set(foodId, hybridFood);
          return hybridFood;
        }
      } catch (error) {
        console.warn(`Failed to fetch food ${foodId} from hybrid service:`, error);
      }
    }
    
    return undefined;
  }

  /**
   * Convert an input portion to grams using available metadata.
   */
  private resolvePortionGrams(food: FoodItem, portion: { quantity: number; unit: string }): number {
    const unit = portion.unit as any;
    if (unit === "piece") {
      const grams = this.options.pieceToGramMap?.[food.id];
      if (grams == null) throw new Error(`Missing grams per piece for food ${food.id}`);
      return portion.quantity * grams;
    }
    if (isMassUnit(unit) || isVolumeUnit(unit)) {
      return portionToGrams(portion.quantity, unit, food.densityGPerMl);
    }
    throw new Error(`Unsupported unit: ${portion.unit}`);
  }

  /**
   * Compute macros for a given portion, normalizing from the food's basePortion.
   */
  async computeItemMacros(foodId: string, portion: { quantity: number; unit: string }): Promise<AggregatedMacros> {
    const food = await this.getFood(foodId);
    if (!food) {
      // Gracefully handle unknown foods by contributing zero macros
      // This lets the UI accept free-form entries without crashing.
      if (typeof window !== "undefined") {
        // eslint-disable-next-line no-console
        console.warn(`Unknown foodId encountered in plan: ${foodId}`);
      }
      return { caloriesKcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sugarG: 0 };
    }
    
    const grams = this.resolvePortionGrams(food, portion);

    // Normalize to grams of basePortion (typically 100g)
    const baseGrams = this.resolvePortionGrams(food, food.basePortion);
    const ratio = grams / baseGrams;
    const m = food.macrosPerBase;
    
    const result = {
      caloriesKcal: m.caloriesKcal * ratio,
      proteinG: m.proteinG * ratio,
      carbsG: m.carbsG * ratio,
      fatG: m.fatG * ratio,
      fiberG: m.fiberG != null ? m.fiberG * ratio : undefined,
      sugarG: m.sugarG != null ? m.sugarG * ratio : undefined,
    };
    
    // Log data source for debugging
    if (food.metadata?.source) {
      console.log(`Computed macros for ${food.name} (${food.metadata.source}):`, {
        portion: `${portion.quantity}${portion.unit}`,
        calories: result.caloriesKcal.toFixed(1),
        protein: result.proteinG.toFixed(1),
        carbs: result.carbsG.toFixed(1),
        fat: result.fatG.toFixed(1),
      });
    }
    
    return result;
  }

  /**
   * Aggregate macros for a list of meal items.
   */
  async computeMealMacros(items: MealItemInput[]): Promise<AggregatedMacros> {
    const macros = await Promise.all(
      items.map(item => this.computeItemMacros(item.foodId, item.portion))
    );
    
    return macros.reduce<AggregatedMacros>(
      (acc, m) => ({
        caloriesKcal: acc.caloriesKcal + m.caloriesKcal,
        proteinG: acc.proteinG + m.proteinG,
        carbsG: acc.carbsG + m.carbsG,
        fatG: acc.fatG + m.fatG,
        fiberG: (acc.fiberG ?? 0) + (m.fiberG ?? 0),
        sugarG: (acc.sugarG ?? 0) + (m.sugarG ?? 0),
      }),
      { caloriesKcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sugarG: 0 }
    );
  }

  /**
   * Aggregate macros for a day (array of meals), returning total and per-meal breakdown.
   */
  async computeDayMacros(meals: MealItemInput[][]): Promise<{ total: AggregatedMacros; perMeal: AggregatedMacros[] }> {
    const perMeal = await Promise.all(
      meals.map((items) => this.computeMealMacros(items))
    );
    
    const total = perMeal.reduce<AggregatedMacros>(
      (acc, m) => ({
        caloriesKcal: acc.caloriesKcal + m.caloriesKcal,
        proteinG: acc.proteinG + m.proteinG,
        carbsG: acc.carbsG + m.carbsG,
        fatG: acc.fatG + m.fatG,
        fiberG: (acc.fiberG ?? 0) + (m.fiberG ?? 0),
        sugarG: (acc.sugarG ?? 0) + (m.sugarG ?? 0),
      }),
      { caloriesKcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sugarG: 0 }
    );

    return { total, perMeal };
  }

  /**
   * Get food quality information
   */
  getFoodQualityInfo(foodId: string): { source: string; confidence: number; lastUpdated?: Date } | null {
    const food = this.foodIndex.get(foodId);
    if (!food || !food.metadata) {
      return null;
    }
    
    return {
      source: food.metadata.source,
      confidence: food.metadata.confidence || 0,
      lastUpdated: food.metadata.lastUpdated,
    };
  }

  /**
   * Search for foods using the hybrid service if available
   */
  async searchFoods(query: string): Promise<FoodItem[]> {
    if (this.hybridService) {
      try {
        const results = await this.hybridService.searchFoods(query);
        return results.foods;
      } catch (error) {
        console.warn('Hybrid service search failed, falling back to local search:', error);
      }
    }
    
    // Fallback to local search
    return Array.from(this.foodIndex.values()).filter(food =>
      food.name.toLowerCase().includes(query.toLowerCase())
    );
  }
}

