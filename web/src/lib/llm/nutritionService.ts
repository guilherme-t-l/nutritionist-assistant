import { HybridFoodService } from "../nutrition/hybridFoodService";
import { MacroEngine } from "../nutrition/macroEngine";
import { SubstitutionEngine, type LLMEnhancedSubstitutionOptions } from "../nutrition/substitutionEngine";
import { FOOD_DATABASE } from "../nutrition/foodDatabase";
import type { 
  FoodItem, 
  MealItemInput, 
  AggregatedMacros, 
  SubstitutionConstraints, 
  SubstitutionResult,
  FoodPortion
} from "../nutrition/types";

export interface NutritionQueryResult {
  success: boolean;
  data?: any;
  error?: string;
  source?: string;
}

export interface MacroCalculationResult {
  macros: AggregatedMacros;
  breakdown: Array<{
    foodId: string;
    foodName: string;
    portion: string;
    macros: AggregatedMacros;
  }>;
  dataQuality: Array<{
    foodId: string;
    source: string;
    confidence: number;
  }>;
}

export class AgentNutritionService {
  private hybridService: HybridFoodService;
  private macroEngine: MacroEngine;
  private substitutionEngine: SubstitutionEngine;

  constructor() {
    this.hybridService = new HybridFoodService({
      enableOpenFoodFacts: true,
      enableLocalDatabase: true,
      maxResults: 20,
      cacheResults: true,
    });

    this.macroEngine = new MacroEngine(FOOD_DATABASE, {
      useHybridService: true,
      hybridService: this.hybridService,
      pieceToGramMap: {
        // Common piece weights for better calculations
        "egg_whole": 50,
        "banana_raw": 118,
        "apple_raw": 182,
        "orange_raw": 154,
        "whole_wheat_bread": 28, // 1 slice
        "white_bread": 25, // 1 slice
      },
    });

    this.substitutionEngine = new SubstitutionEngine();
  }

  /**
   * Search for foods by name or description
   */
  async searchFoods(query: string): Promise<NutritionQueryResult> {
    try {
      const results = await this.hybridService.searchFoods(query);
      
      return {
        success: true,
        data: {
          foods: results.foods.slice(0, 10), // Limit for agent responses
          totalCount: results.totalCount,
          source: results.source,
        },
        source: results.source,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to search foods: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Get detailed nutrition information for a specific food
   */
  async getFoodInfo(foodId: string): Promise<NutritionQueryResult> {
    try {
      const food = await this.macroEngine.getFood(foodId);
      if (!food) {
        return {
          success: false,
          error: `Food with ID "${foodId}" not found`,
        };
      }

      const qualityInfo = this.macroEngine.getFoodQualityInfo(foodId);

      return {
        success: true,
        data: {
          food,
          dataQuality: qualityInfo,
          nutritionPer100g: food.macrosPerBase,
        },
        source: food.metadata?.source || 'local',
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get food info: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Calculate macros for a list of foods and portions
   */
  async calculateMacros(items: MealItemInput[]): Promise<NutritionQueryResult> {
    try {
      const totalMacros = await this.macroEngine.computeMealMacros(items);
      
      // Get breakdown for each item
      const breakdown = await Promise.all(
        items.map(async (item) => {
          const food = await this.macroEngine.getFood(item.foodId);
          const itemMacros = await this.macroEngine.computeItemMacros(item.foodId, item.portion);
          
          return {
            foodId: item.foodId,
            foodName: food?.name || 'Unknown Food',
            portion: `${item.portion.quantity}${item.portion.unit}`,
            macros: itemMacros,
          };
        })
      );

      // Get data quality information
      const dataQuality = items.map((item) => {
        const quality = this.macroEngine.getFoodQualityInfo(item.foodId);
        return {
          foodId: item.foodId,
          source: quality?.source || 'unknown',
          confidence: quality?.confidence || 0,
        };
      });

      const result: MacroCalculationResult = {
        macros: totalMacros,
        breakdown,
        dataQuality,
      };

      return {
        success: true,
        data: result,
        source: 'macro_engine',
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to calculate macros: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Find foods by barcode
   */
  async getFoodByBarcode(barcode: string): Promise<NutritionQueryResult> {
    try {
      const food = await this.hybridService.getFoodByBarcode(barcode);
      if (!food) {
        return {
          success: false,
          error: `No food found for barcode "${barcode}"`,
        };
      }

      return {
        success: true,
        data: { food },
        source: 'open_food_facts',
      };
    } catch (error) {
      return {
        success: false,
        error: `Barcode lookup failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Get nutrition recommendations based on goals
   */
  async getNutritionRecommendations(params: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    dietaryRestrictions?: string[];
    goals?: string[];
  }): Promise<NutritionQueryResult> {
    try {
      const recommendations = this.generateNutritionGuidelines(params);
      
      return {
        success: true,
        data: {
          guidelines: recommendations,
          macroTargets: this.calculateMacroTargets(params),
        },
        source: 'nutrition_engine',
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to generate recommendations: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Analyze a meal plan for nutritional completeness
   */
  async analyzeMealPlan(mealPlan: {
    breakfast?: MealItemInput[];
    lunch?: MealItemInput[];
    dinner?: MealItemInput[];
    snacks?: MealItemInput[];
  }): Promise<NutritionQueryResult> {
    try {
      const meals = [
        mealPlan.breakfast || [],
        mealPlan.lunch || [],
        mealPlan.dinner || [],
        mealPlan.snacks || [],
      ];

      const analysis = await this.macroEngine.computeDayMacros(meals);
      
      // Analyze nutritional balance
      const nutritionalAnalysis = this.analyzeNutritionalBalance(analysis.total);
      
      return {
        success: true,
        data: {
          dailyMacros: analysis.total,
          mealBreakdown: analysis.perMeal,
          nutritionalAnalysis,
          recommendations: this.generateMealPlanRecommendations(analysis.total),
        },
        source: 'nutrition_analysis',
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to analyze meal plan: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Get substitute food recommendations
   */
  async findFoodSubstitutes(foodId: string, criteria?: {
    similarMacros?: boolean;
    allergenFree?: string[];
    dietaryRestrictions?: string[];
  }): Promise<NutritionQueryResult> {
    try {
      const originalFood = await this.macroEngine.getFood(foodId);
      if (!originalFood) {
        return {
          success: false,
          error: `Original food "${foodId}" not found`,
        };
      }

      // Find similar foods based on macro profile
      const substitutes = await this.findSimilarFoods(originalFood, criteria);
      
      return {
        success: true,
        data: {
          originalFood,
          substitutes: substitutes.slice(0, 5), // Top 5 substitutes
        },
        source: 'substitution_engine',
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to find substitutes: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Private helper methods
   */
  private generateNutritionGuidelines(params: any): any {
    const guidelines = {
      generalPrinciples: [
        "Eat a variety of nutrient-dense foods",
        "Balance macronutrients appropriately",
        "Stay hydrated throughout the day",
        "Include fiber-rich foods for digestive health",
        "Limit processed foods and added sugars",
      ],
    };

    if (params.dietaryRestrictions?.includes('vegetarian')) {
      guidelines.generalPrinciples.push("Focus on plant-based protein sources like legumes, nuts, and seeds");
    }

    if (params.goals?.includes('weight_loss')) {
      guidelines.generalPrinciples.push("Create a moderate caloric deficit while maintaining adequate protein");
    }

    return guidelines;
  }

  private calculateMacroTargets(params: any): any {
    const targets: any = {};

    if (params.calories) {
      targets.calories = params.calories;
      // Calculate protein (15-30% of calories)
      targets.proteinRange = {
        min: Math.round((params.calories * 0.15) / 4),
        max: Math.round((params.calories * 0.30) / 4),
      };
      // Calculate carbs (45-65% of calories)
      targets.carbsRange = {
        min: Math.round((params.calories * 0.45) / 4),
        max: Math.round((params.calories * 0.65) / 4),
      };
      // Calculate fat (20-35% of calories)
      targets.fatRange = {
        min: Math.round((params.calories * 0.20) / 9),
        max: Math.round((params.calories * 0.35) / 9),
      };
    }

    return targets;
  }

  private analyzeNutritionalBalance(macros: AggregatedMacros): any {
    const analysis = {
      calorieDensity: macros.caloriesKcal > 0 ? 'appropriate' : 'very_low',
      proteinAdequacy: macros.proteinG >= 50 ? 'adequate' : 'low',
      fiberContent: (macros.fiberG || 0) >= 25 ? 'adequate' : 'low',
      sugarContent: (macros.sugarG || 0) > 50 ? 'high' : 'moderate',
    };

    return analysis;
  }

  private generateMealPlanRecommendations(macros: AggregatedMacros): string[] {
    const recommendations: string[] = [];

    if (macros.proteinG < 50) {
      recommendations.push("Consider adding more protein sources like lean meats, fish, eggs, or legumes");
    }

    if ((macros.fiberG || 0) < 25) {
      recommendations.push("Include more fiber-rich foods like vegetables, fruits, and whole grains");
    }

    if ((macros.sugarG || 0) > 50) {
      recommendations.push("Consider reducing added sugars and focusing on natural fruit sugars");
    }

    if (macros.caloriesKcal < 1200) {
      recommendations.push("Daily calorie intake may be too low for sustainable nutrition");
    }

    return recommendations;
  }

  private async findSimilarFoods(targetFood: FoodItem, criteria?: any): Promise<FoodItem[]> {
    // Simple similarity based on macro profile
    // In a real implementation, this would be more sophisticated
    const allFoods = Array.from(FOOD_DATABASE);
    
    const similarities = allFoods
      .filter(food => food.id !== targetFood.id)
      .map(food => ({
        food,
        similarity: this.calculateMacroSimilarity(targetFood.macrosPerBase, food.macrosPerBase),
      }))
      .sort((a, b) => b.similarity - a.similarity);

    return similarities.slice(0, 10).map(s => s.food);
  }

  private calculateMacroSimilarity(macros1: any, macros2: any): number {
    // Simple similarity calculation based on macro ratios
    const diff1 = Math.abs(macros1.proteinG - macros2.proteinG) / Math.max(macros1.proteinG, macros2.proteinG, 1);
    const diff2 = Math.abs(macros1.carbsG - macros2.carbsG) / Math.max(macros1.carbsG, macros2.carbsG, 1);
    const diff3 = Math.abs(macros1.fatG - macros2.fatG) / Math.max(macros1.fatG, macros2.fatG, 1);
    
    return 1 - (diff1 + diff2 + diff3) / 3;
  }

  /**
   * Find food substitutions with macro tolerance
   */
  async findSubstitutions(
    foodId: string,
    portion: FoodPortion,
    constraints?: SubstitutionConstraints,
    llmOptions?: LLMEnhancedSubstitutionOptions
  ): Promise<NutritionQueryResult> {
    try {
      const result = await this.substitutionEngine.findSubstitutions(
        foodId,
        portion,
        constraints,
        llmOptions
      );

      return {
        success: true,
        data: result,
        source: 'substitution_engine',
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to find substitutions: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Find substitutions with user context for better LLM-enhanced ranking
   */
  async findSmartSubstitutions(
    foodId: string,
    portion: FoodPortion,
    options: {
      constraints?: SubstitutionConstraints;
      mealContext?: string;
      userContext?: string;
      enableLLMRanking?: boolean;
    } = {}
  ): Promise<NutritionQueryResult> {
    try {
      const { constraints, mealContext, userContext, enableLLMRanking = true } = options;

      const llmOptions: LLMEnhancedSubstitutionOptions = {
        enableLLMRanking,
        mealContext,
        userContext,
      };

      const result = await this.substitutionEngine.findSubstitutions(
        foodId,
        portion,
        constraints,
        llmOptions
      );

      return {
        success: true,
        data: {
          ...result,
          enhancedWithAI: enableLLMRanking,
        },
        source: 'smart_substitution_engine',
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to find smart substitutions: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Test connectivity to all nutrition services
   */
  async testConnectivity(): Promise<NutritionQueryResult> {
    try {
      const connectivity = await this.hybridService.testConnectivity();
      const stats = this.hybridService.getStats();

      return {
        success: true,
        data: {
          connectivity,
          stats,
          status: connectivity.overall ? 'healthy' : 'degraded',
        },
        source: 'system_health',
      };
    } catch (error) {
      return {
        success: false,
        error: `Connectivity test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}

// Singleton instance for the agent
let nutritionService: AgentNutritionService | null = null;

export function getNutritionService(): AgentNutritionService {
  if (!nutritionService) {
    nutritionService = new AgentNutritionService();
  }
  return nutritionService;
}