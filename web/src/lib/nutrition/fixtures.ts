import type { FoodItem } from "./types";
import { FOOD_DATABASE, getFoodById } from "./foodDatabase";

// Re-export the comprehensive database for backward compatibility
export const FOODS_FIXTURE: FoodItem[] = FOOD_DATABASE;

// Keep the piece map for foods that have known per-piece weights
export const PIECE_MAP: Record<string, number> = {
  egg_whole: 50, // grams per piece (medium egg)
  egg_white: 33, // grams per piece (medium egg white)
  egg_yolk: 17,  // grams per piece (medium egg yolk)
};

// Helper function to get foods by category for testing
export function getTestFoodsByCategory(category: string): FoodItem[] {
  const categoryMap: Record<string, string[]> = {
    "grains": ["oats_rolled", "quinoa_cooked", "brown_rice_cooked"],
    "proteins": ["chicken_breast_cooked", "egg_whole", "salmon_cooked"],
    "vegetables": ["broccoli_raw", "spinach_raw", "carrots_raw"],
    "fruits": ["banana_raw", "apple_raw", "strawberries_raw"],
  };
  
  const foodIds = categoryMap[category.toLowerCase()] || [];
  return FOOD_DATABASE.filter(food => foodIds.includes(food.id));
}

