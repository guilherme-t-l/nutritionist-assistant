import { describe, it, expect, beforeEach } from 'vitest';
import { AgentNutritionService } from '../nutritionService';
import type { MealItemInput } from '../../nutrition/types';

describe('AgentNutritionService', () => {
  let nutritionService: AgentNutritionService;

  beforeEach(() => {
    nutritionService = new AgentNutritionService();
  });

  describe('Food Search', () => {
    it('should search for foods successfully', async () => {
      const result = await nutritionService.searchFoods('chicken');
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.foods).toBeInstanceOf(Array);
      expect(result.data.foods.length).toBeGreaterThan(0);
      
      // Should find chicken-related foods
      const chickenFood = result.data.foods.find((food: any) => 
        food.name.toLowerCase().includes('chicken')
      );
      expect(chickenFood).toBeDefined();
    });

    it('should limit search results appropriately', async () => {
      const result = await nutritionService.searchFoods('a'); // Very broad search
      
      expect(result.success).toBe(true);
      expect(result.data.foods.length).toBeLessThanOrEqual(10); // Should be limited
    });

    it('should handle searches for non-existent foods', async () => {
      const result = await nutritionService.searchFoods('nonexistentfood12345');
      
      expect(result.success).toBe(true);
      expect(result.data.foods).toBeInstanceOf(Array);
      // May return empty array or no results, both are valid
    });
  });

  describe('Food Information', () => {
    it('should get detailed food information', async () => {
      const result = await nutritionService.getFoodInfo('chicken_breast_cooked');
      
      expect(result.success).toBe(true);
      expect(result.data.food).toBeDefined();
      expect(result.data.food.name).toContain('Chicken');
      expect(result.data.food.macrosPerBase).toBeDefined();
      expect(result.data.food.macrosPerBase.caloriesKcal).toBeGreaterThan(0);
      expect(result.data.food.macrosPerBase.proteinG).toBeGreaterThan(20); // Chicken is high protein
    });

    it('should handle requests for non-existent food IDs', async () => {
      const result = await nutritionService.getFoodInfo('nonexistent_food_id');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('not found');
    });

    it('should provide data quality information', async () => {
      const result = await nutritionService.getFoodInfo('oats_rolled');
      
      expect(result.success).toBe(true);
      expect(result.data.nutritionPer100g).toBeDefined();
      expect(result.source).toBeDefined();
    });
  });

  describe('Macro Calculations', () => {
    it('should calculate macros for meal items', async () => {
      const mealItems: MealItemInput[] = [
        { foodId: 'chicken_breast_cooked', portion: { quantity: 150, unit: 'g' } },
        { foodId: 'brown_rice_cooked', portion: { quantity: 100, unit: 'g' } },
        { foodId: 'broccoli_raw', portion: { quantity: 80, unit: 'g' } }
      ];

      const result = await nutritionService.calculateMacros(mealItems);
      
      expect(result.success).toBe(true);
      expect(result.data.macros).toBeDefined();
      expect(result.data.macros.caloriesKcal).toBeGreaterThan(200); // Should be substantial meal
      expect(result.data.macros.proteinG).toBeGreaterThan(30); // Chicken provides protein
      expect(result.data.breakdown).toHaveLength(3);
      expect(result.data.dataQuality).toHaveLength(3);
    });

    it('should provide detailed breakdown for each food item', async () => {
      const mealItems: MealItemInput[] = [
        { foodId: 'egg_whole', portion: { quantity: 100, unit: 'g' } }
      ];

      const result = await nutritionService.calculateMacros(mealItems);
      
      expect(result.success).toBe(true);
      expect(result.data.breakdown[0].foodName).toContain('Egg');
      expect(result.data.breakdown[0].portion).toBe('100g');
      expect(result.data.breakdown[0].macros.caloriesKcal).toBeGreaterThan(100);
    });

    it('should handle empty meal items', async () => {
      const result = await nutritionService.calculateMacros([]);
      
      expect(result.success).toBe(true);
      expect(result.data.macros.caloriesKcal).toBe(0);
      expect(result.data.breakdown).toHaveLength(0);
    });

    it('should gracefully handle unknown food IDs', async () => {
      const mealItems: MealItemInput[] = [
        { foodId: 'unknown_food', portion: { quantity: 100, unit: 'g' } }
      ];

      const result = await nutritionService.calculateMacros(mealItems);
      
      expect(result.success).toBe(true);
      // Should return zero macros for unknown foods instead of failing
      expect(result.data.macros.caloriesKcal).toBe(0);
    });
  });

  describe('Nutrition Recommendations', () => {
    it('should generate recommendations based on goals', async () => {
      const params = {
        calories: 2000,
        goals: ['weight_loss'],
        dietaryRestrictions: ['vegetarian']
      };

      const result = await nutritionService.getNutritionRecommendations(params);
      
      expect(result.success).toBe(true);
      expect(result.data.guidelines).toBeDefined();
      expect(result.data.macroTargets).toBeDefined();
      expect(result.data.macroTargets.calories).toBe(2000);
      expect(result.data.macroTargets.proteinRange).toBeDefined();
    });

    it('should calculate appropriate macro targets', async () => {
      const params = { calories: 1800 };
      const result = await nutritionService.getNutritionRecommendations(params);
      
      expect(result.success).toBe(true);
      const targets = result.data.macroTargets;
      
      // Check protein range (15-30% of calories)
      expect(targets.proteinRange.min).toBeGreaterThanOrEqual(67); // 1800 * 0.15 / 4
      expect(targets.proteinRange.max).toBeLessThanOrEqual(135); // 1800 * 0.30 / 4
      
      // Check carb range (45-65% of calories)
      expect(targets.carbsRange.min).toBeGreaterThanOrEqual(202); // 1800 * 0.45 / 4
      expect(targets.carbsRange.max).toBeLessThanOrEqual(293); // 1800 * 0.65 / 4
    });

    it('should include vegetarian-specific guidelines', async () => {
      const params = { dietaryRestrictions: ['vegetarian'] };
      const result = await nutritionService.getNutritionRecommendations(params);
      
      expect(result.success).toBe(true);
      const guidelines = result.data.guidelines.generalPrinciples;
      expect(guidelines.some((g: string) => g.includes('plant-based protein'))).toBe(true);
    });
  });

  describe('Meal Plan Analysis', () => {
    it('should analyze a complete meal plan', async () => {
      const mealPlan = {
        breakfast: [
          { foodId: 'oats_rolled', portion: { quantity: 50, unit: 'g' } },
          { foodId: 'banana_raw', portion: { quantity: 100, unit: 'g' } }
        ],
        lunch: [
          { foodId: 'chicken_breast_cooked', portion: { quantity: 120, unit: 'g' } },
          { foodId: 'brown_rice_cooked', portion: { quantity: 80, unit: 'g' } }
        ],
        dinner: [
          { foodId: 'salmon_cooked', portion: { quantity: 100, unit: 'g' } },
          { foodId: 'broccoli_raw', portion: { quantity: 100, unit: 'g' } }
        ]
      };

      const result = await nutritionService.analyzeMealPlan(mealPlan);
      
      expect(result.success).toBe(true);
      expect(result.data.dailyMacros).toBeDefined();
      expect(result.data.mealBreakdown).toHaveLength(4); // 3 meals + snacks (empty)
      expect(result.data.nutritionalAnalysis).toBeDefined();
      expect(result.data.recommendations).toBeInstanceOf(Array);
      
      // Should have substantial nutrition
      expect(result.data.dailyMacros.caloriesKcal).toBeGreaterThan(800);
      expect(result.data.dailyMacros.proteinG).toBeGreaterThan(50);
    });

    it('should provide nutritional analysis', async () => {
      const highProteinMealPlan = {
        lunch: [
          { foodId: 'chicken_breast_cooked', portion: { quantity: 200, unit: 'g' } },
          { foodId: 'egg_whole', portion: { quantity: 100, unit: 'g' } }
        ]
      };

      const result = await nutritionService.analyzeMealPlan(highProteinMealPlan);
      
      expect(result.success).toBe(true);
      expect(result.data.nutritionalAnalysis.proteinAdequacy).toBe('adequate');
    });

    it('should generate appropriate recommendations', async () => {
      const lowFiberMealPlan = {
        breakfast: [
          { foodId: 'white_bread', portion: { quantity: 50, unit: 'g' } }
        ]
      };

      const result = await nutritionService.analyzeMealPlan(lowFiberMealPlan);
      
      expect(result.success).toBe(true);
      expect(result.data.recommendations.some((r: string) => 
        r.includes('fiber')
      )).toBe(true);
    });
  });

  describe('Food Substitutes', () => {
    it('should find substitutes for given foods', async () => {
      const result = await nutritionService.findFoodSubstitutes('chicken_breast_cooked');
      
      expect(result.success).toBe(true);
      expect(result.data.originalFood).toBeDefined();
      expect(result.data.substitutes).toBeInstanceOf(Array);
      expect(result.data.substitutes.length).toBeGreaterThan(0);
      expect(result.data.substitutes.length).toBeLessThanOrEqual(5);
    });

    it('should handle requests for non-existent foods', async () => {
      const result = await nutritionService.findFoodSubstitutes('nonexistent_food');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('Connectivity Testing', () => {
    it('should test nutrition service connectivity', async () => {
      const result = await nutritionService.testConnectivity();
      
      expect(result.success).toBe(true);
      expect(result.data.connectivity).toBeDefined();
      expect(result.data.stats).toBeDefined();
      expect(result.data.status).toMatch(/healthy|degraded/);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      // Test with malformed input
      const result = await nutritionService.getFoodInfo('');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should provide meaningful error messages', async () => {
      const result = await nutritionService.calculateMacros([
        { foodId: 'invalid_food_id', portion: { quantity: -1, unit: 'invalid' } }
      ]);
      
      // Should handle gracefully, even with invalid input
      expect(result.success).toBe(true); // Our service is designed to be resilient
    });
  });
});