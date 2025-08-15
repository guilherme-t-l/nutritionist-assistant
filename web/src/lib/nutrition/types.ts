export type CanonicalUnit =
  | "g" // grams
  | "ml" // milliliters
  | "kcal";

export interface MacroProfile {
  caloriesKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG?: number;
  sugarG?: number;
}

export interface FoodPortion {
  /** Quantity in the specified unit (e.g., 100 grams, 1 cup) */
  quantity: number;
  /** Unit string such as g, ml, cup, tbsp, tsp, piece */
  unit: string;
}

export interface FoodItem {
  id: string;
  name: string;
  /** Per 100g or per serving macro basis must be normalized via conversions */
  basePortion: FoodPortion; // typically { quantity: 100, unit: "g" }
  macrosPerBase: MacroProfile;
  /**
   * Optional density information to convert between volume and mass.
   * grams per milliliter for liquids/semi-solids; if unknown, require mass-based inputs.
   */
  densityGPerMl?: number;
  /**
   * Optional metadata for tracking data sources and additional information
   */
  metadata?: {
    source: 'local' | 'open_food_facts' | 'usda_fdc' | 'user_contributed';
    barcode?: string;
    brand?: string;
    lastUpdated?: Date;
    imageUrl?: string;
    nutritionImageUrl?: string;
    categories?: string[];
    countries?: string[];
    userNotes?: string;
    confidence?: number; // 0-1 score for data quality
  };
}

export interface MealItemInput {
  foodId: string;
  portion: FoodPortion;
}

export interface AggregatedMacros extends MacroProfile {}

