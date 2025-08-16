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

// ===== SUBSTITUTION ENGINE TYPES =====

export interface UserPreferences {
  allergies?: string[];
  dislikes?: string[];
  cuisine?: string[];
  budget?: 'low' | 'medium' | 'high';
  dietaryRestrictions?: ('vegetarian' | 'vegan' | 'gluten-free' | 'dairy-free' | 'keto' | 'paleo')[];
}

export interface SubstitutionConstraints {
  /** Maximum allowed macro deviation percentage (default: 5%) */
  macroTolerancePercent?: number;
  /** Maximum number of suggestions to return */
  maxSuggestions?: number;
  /** Minimum confidence score for data quality */
  minConfidence?: number;
  /** User preferences and restrictions */
  preferences?: UserPreferences;
  /** Whether to include foods from external APIs */
  includeExternalSources?: boolean;
}

export interface MacroDistance {
  caloriesPercent: number;
  proteinPercent: number;
  carbsPercent: number;
  fatPercent: number;
  fiberPercent?: number;
  sugarPercent?: number;
  /** Overall macro distance score (0-100, lower is better) */
  overallScore: number;
}

export interface SubstitutionScore {
  /** Macro similarity score (0-100, higher is better) */
  macroScore: number;
  /** Preference alignment score (0-100, higher is better) */
  preferenceScore: number;
  /** Data quality/availability score (0-100, higher is better) */
  availabilityScore: number;
  /** Cost efficiency score (0-100, higher is better) */
  costScore: number;
  /** Overall weighted score (0-100, higher is better) */
  totalScore: number;
  /** Detailed macro distance breakdown */
  macroDistance: MacroDistance;
}

export interface SubstitutionCandidate {
  /** The suggested replacement food */
  food: FoodItem;
  /** Adjusted portion to match target macros as closely as possible */
  suggestedPortion: FoodPortion;
  /** Detailed scoring breakdown */
  score: SubstitutionScore;
  /** Computed macros for the suggested portion */
  macros: MacroProfile;
  /** Reason why this substitution is suitable */
  reason: string;
}

export interface SubstitutionResult {
  /** The original food item being replaced */
  originalFood: FoodItem;
  /** Original portion */
  originalPortion: FoodPortion;
  /** Original macros */
  originalMacros: MacroProfile;
  /** List of substitution candidates, sorted by score */
  candidates: SubstitutionCandidate[];
  /** Whether any viable substitutions were found */
  hasViableSubstitutions: boolean;
  /** Processing metadata */
  metadata: {
    totalCandidatesEvaluated: number;
    processingTimeMs: number;
    constraintsApplied: SubstitutionConstraints;
  };
}

export type AggregatedMacros = MacroProfile;

