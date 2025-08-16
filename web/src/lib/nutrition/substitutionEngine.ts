import type { 
  FoodItem, 
  FoodPortion, 
  MacroProfile, 
  UserPreferences,
  SubstitutionConstraints,
  SubstitutionResult,
  SubstitutionCandidate,
  SubstitutionScore,
  MacroDistance
} from "./types";
import { HybridFoodService } from "./hybridFoodService";
import { MacroEngine } from "./macroEngine";

export interface LLMEnhancedSubstitutionOptions {
  /** Whether to use LLM for enhanced reasoning and ranking */
  enableLLMRanking?: boolean;
  /** LLM model to use for ranking */
  llmModel?: string;
  /** Context about the meal or dietary goals */
  mealContext?: string;
  /** Additional user context for better recommendations */
  userContext?: string;
}

export class SubstitutionEngine {
  private hybridService: HybridFoodService;
  private macroEngine: MacroEngine;

  constructor() {
    this.hybridService = new HybridFoodService();
    this.macroEngine = new MacroEngine();
  }

  /**
   * Find suitable substitutions for a given food item and portion
   */
  async findSubstitutions(
    originalFoodId: string,
    originalPortion: FoodPortion,
    constraints: SubstitutionConstraints = {},
    llmOptions: LLMEnhancedSubstitutionOptions = {}
  ): Promise<SubstitutionResult> {
    const startTime = Date.now();

    // Apply default constraints
    const effectiveConstraints: SubstitutionConstraints = {
      macroTolerancePercent: 5,
      maxSuggestions: 10,
      minConfidence: 0.7,
      includeExternalSources: true,
      ...constraints,
    };

    // Get original food and compute its macros
    const originalFood = await this.macroEngine.getFood(originalFoodId);
    if (!originalFood) {
      throw new Error(`Food not found: ${originalFoodId}`);
    }

    const originalMacros = await this.macroEngine.computeItemMacros(originalFoodId, originalPortion);

    // Get all available foods as potential candidates
    const allFoods = await this.getAllFoods(effectiveConstraints.includeExternalSources);
    
    // Filter and score candidates
    let candidates = await this.evaluateCandidates(
      originalFood,
      originalMacros,
      allFoods,
      effectiveConstraints
    );

    // Apply LLM ranking if enabled
    if (llmOptions.enableLLMRanking && candidates.length > 0) {
      candidates = await this.enhanceWithLLMRanking(
        originalFood,
        originalPortion,
        candidates,
        llmOptions,
        effectiveConstraints
      );
    }

    // Sort by total score (descending)
    candidates.sort((a, b) => b.score.totalScore - a.score.totalScore);

    // Limit results
    const limitedCandidates = candidates.slice(0, effectiveConstraints.maxSuggestions);

    const processingTime = Date.now() - startTime;

    return {
      originalFood,
      originalPortion,
      originalMacros,
      candidates: limitedCandidates,
      hasViableSubstitutions: limitedCandidates.length > 0,
      metadata: {
        totalCandidatesEvaluated: allFoods.length,
        processingTimeMs: processingTime,
        constraintsApplied: effectiveConstraints,
      },
    };
  }

  /**
   * Get all available foods from various sources
   */
  private async getAllFoods(includeExternal: boolean = true): Promise<FoodItem[]> {
    const foods: FoodItem[] = [];
    
    // Get foods from hybrid service which includes local database
    const localFoods = await this.hybridService.getAllFoods();
    foods.push(...localFoods);

    // TODO: Add external sources if needed
    // For now, the hybrid service should provide access to all food sources

    return foods;
  }

  /**
   * Evaluate and score all potential candidates
   */
  private async evaluateCandidates(
    originalFood: FoodItem,
    originalMacros: MacroProfile,
    candidates: FoodItem[],
    constraints: SubstitutionConstraints
  ): Promise<SubstitutionCandidate[]> {
    const results: SubstitutionCandidate[] = [];

    for (const candidate of candidates) {
      // Skip the original food itself
      if (candidate.id === originalFood.id) {
        continue;
      }

      // Apply basic filters
      if (!this.passesBasicFilters(candidate, constraints)) {
        continue;
      }

      try {
        // Calculate optimal portion for this candidate
        const suggestedPortion = await this.calculateOptimalPortion(candidate, originalMacros);
        const candidateMacros = await this.macroEngine.computeItemMacros(candidate.id, suggestedPortion);

        // Calculate macro distance
        const macroDistance = this.calculateMacroDistance(originalMacros, candidateMacros);

        // Check if within tolerance
        if (macroDistance.overallScore > constraints.macroTolerancePercent!) {
          continue;
        }

        // Calculate comprehensive score
        const score = await this.calculateScore(
          originalFood,
          candidate,
          macroDistance,
          constraints.preferences
        );

        // Generate substitution reason
        const reason = this.generateSubstitutionReason(originalFood, candidate, macroDistance);

        results.push({
          food: candidate,
          suggestedPortion,
          score,
          macros: candidateMacros,
          reason,
        });
      } catch (error) {
        // Skip candidates that cause calculation errors
        console.warn(`Error evaluating candidate ${candidate.id}:`, error);
        continue;
      }
    }

    return results;
  }

  /**
   * Enhance substitution candidates with LLM ranking and reasoning
   */
  private async enhanceWithLLMRanking(
    originalFood: FoodItem,
    originalPortion: FoodPortion,
    candidates: SubstitutionCandidate[],
    llmOptions: LLMEnhancedSubstitutionOptions,
    constraints: SubstitutionConstraints
  ): Promise<SubstitutionCandidate[]> {
    try {
      // Prepare context for LLM
      const context = this.buildLLMContext(originalFood, originalPortion, candidates, llmOptions, constraints);
      
      // Get LLM ranking and insights
      const llmResponse = await this.callLLMForRanking(context, llmOptions);
      
      // Parse and apply LLM recommendations
      return this.applyLLMRanking(candidates, llmResponse);
    } catch (error) {
      console.warn('LLM ranking failed, using original ranking:', error);
      return candidates;
    }
  }

  /**
   * Build context string for LLM analysis
   */
  private buildLLMContext(
    originalFood: FoodItem,
    originalPortion: FoodPortion,
    candidates: SubstitutionCandidate[],
    llmOptions: LLMEnhancedSubstitutionOptions,
    constraints: SubstitutionConstraints
  ): string {
    const originalMacroStr = this.formatMacros(candidates[0]?.score.macroDistance ? 
      this.reconstructOriginalMacros(candidates[0], candidates[0].score.macroDistance) : 
      { caloriesKcal: 0, proteinG: 0, carbsG: 0, fatG: 0 });

    const candidatesStr = candidates.slice(0, 5).map((candidate, index) => 
      `${index + 1}. ${candidate.food.name} (${candidate.suggestedPortion.quantity}${candidate.suggestedPortion.unit})
         Macros: ${this.formatMacros(candidate.macros)}
         Score: ${candidate.score.totalScore.toFixed(1)}/100
         Reason: ${candidate.reason}`
    ).join('\n\n');

    const preferencesStr = constraints.preferences ? 
      `User preferences: ${JSON.stringify(constraints.preferences, null, 2)}` : 
      'No specific preferences provided';

    return `You are a nutritionist assistant helping rank food substitutions.

Original food: ${originalFood.name} (${originalPortion.quantity}${originalPortion.unit})
Original macros: ${originalMacroStr}

${llmOptions.mealContext ? `Meal context: ${llmOptions.mealContext}` : ''}
${llmOptions.userContext ? `User context: ${llmOptions.userContext}` : ''}
${preferencesStr}

Top substitution candidates (ranked by algorithm):
${candidatesStr}

Please analyze these substitutions and provide:
1. A reordered ranking (1-${Math.min(5, candidates.length)}) based on nutritional value, practicality, and user context
2. Brief reasoning for each recommendation
3. Any additional insights about the substitutions

Format your response as JSON:
{
  "rankings": [
    {"position": 1, "originalIndex": 0, "reasoning": "..."},
    {"position": 2, "originalIndex": 2, "reasoning": "..."}
  ],
  "insights": "General insights about the substitution group..."
}`;
  }

  /**
   * Format macros for display
   */
  private formatMacros(macros: MacroProfile): string {
    return `${macros.caloriesKcal.toFixed(0)} cal, ${macros.proteinG.toFixed(1)}g protein, ${macros.carbsG.toFixed(1)}g carbs, ${macros.fatG.toFixed(1)}g fat`;
  }

  /**
   * Reconstruct original macros from candidate and distance
   */
  private reconstructOriginalMacros(candidate: SubstitutionCandidate, distance: MacroDistance): MacroProfile {
    // This is an approximation - in a real system you'd pass the original macros directly
    return candidate.macros;
  }

  /**
   * Call LLM service for ranking analysis
   */
  private async callLLMForRanking(context: string, options: LLMEnhancedSubstitutionOptions): Promise<any> {
    // For now, this is a placeholder that would integrate with the existing LLM infrastructure
    // In a real implementation, this would call the OpenAI client or other LLM service
    
    if (typeof window !== 'undefined') {
      // Client-side: would make API call to /api/llm/rank-substitutions
      const response = await fetch('/api/llm/rank-substitutions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          context, 
          model: options.llmModel || 'gpt-3.5-turbo' 
        }),
      });
      
      if (!response.ok) {
        throw new Error(`LLM API call failed: ${response.statusText}`);
      }
      
      return await response.json();
    } else {
      // Server-side: would call LLM directly
      // For now, return a mock response to avoid breaking the system
      return {
        rankings: [],
        insights: "LLM ranking not yet implemented"
      };
    }
  }

  /**
   * Apply LLM ranking to candidates
   */
  private applyLLMRanking(
    candidates: SubstitutionCandidate[], 
    llmResponse: any
  ): SubstitutionCandidate[] {
    if (!llmResponse.rankings || !Array.isArray(llmResponse.rankings)) {
      return candidates;
    }

    try {
      // Apply LLM ranking by adjusting scores
      const enhancedCandidates = [...candidates];
      
      llmResponse.rankings.forEach((ranking: any, index: number) => {
        const candidateIndex = ranking.originalIndex;
        if (candidateIndex >= 0 && candidateIndex < enhancedCandidates.length) {
          // Boost score based on LLM ranking (higher ranking = higher boost)
          const boost = (llmResponse.rankings.length - index) * 5; // 5 point boost per ranking position
          enhancedCandidates[candidateIndex].score.totalScore += boost;
          
          // Update reasoning with LLM insights
          if (ranking.reasoning) {
            enhancedCandidates[candidateIndex].reason = 
              `${enhancedCandidates[candidateIndex].reason}. LLM insight: ${ranking.reasoning}`;
          }
        }
      });

      return enhancedCandidates;
    } catch (error) {
      console.warn('Failed to apply LLM ranking:', error);
      return candidates;
    }
  }

  /**
   * Apply basic filters (confidence, preferences, etc.)
   */
  private passesBasicFilters(candidate: FoodItem, constraints: SubstitutionConstraints): boolean {
    // Check minimum confidence
    if (constraints.minConfidence && candidate.metadata?.confidence) {
      if (candidate.metadata.confidence < constraints.minConfidence) {
        return false;
      }
    }

    // Check dietary restrictions and allergies
    if (constraints.preferences) {
      if (!this.respectsPreferences(candidate, constraints.preferences)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if food respects user preferences and restrictions
   */
  private respectsPreferences(food: FoodItem, preferences: UserPreferences): boolean {
    // Check allergies - this is a simplified check based on name
    // In a real system, you'd want a more sophisticated allergen database
    if (preferences.allergies) {
      const foodNameLower = food.name.toLowerCase();
      for (const allergen of preferences.allergies) {
        if (foodNameLower.includes(allergen.toLowerCase())) {
          return false;
        }
      }
    }

    // Check dislikes
    if (preferences.dislikes) {
      const foodNameLower = food.name.toLowerCase();
      for (const dislike of preferences.dislikes) {
        if (foodNameLower.includes(dislike.toLowerCase())) {
          return false;
        }
      }
    }

    // TODO: Add more sophisticated dietary restriction checking
    // This would require categorizing foods by type (vegetarian, vegan, etc.)

    return true;
  }

  /**
   * Calculate optimal portion size to match target macros as closely as possible
   */
  private async calculateOptimalPortion(food: FoodItem, targetMacros: MacroProfile): Promise<FoodPortion> {
    // Start with a base portion and scale based on calories (primary target)
    const basePortion: FoodPortion = { quantity: 100, unit: "g" };
    const baseMacros = await this.macroEngine.computeItemMacros(food.id, basePortion);

    if (baseMacros.caloriesKcal === 0) {
      return basePortion; // Avoid division by zero
    }

    // Scale based on calorie ratio
    const calorieRatio = targetMacros.caloriesKcal / baseMacros.caloriesKcal;
    const scaledQuantity = Math.max(1, basePortion.quantity * calorieRatio);

    return {
      quantity: Math.round(scaledQuantity * 10) / 10, // Round to 1 decimal place
      unit: basePortion.unit,
    };
  }

  /**
   * Calculate macro distance between original and candidate
   */
  private calculateMacroDistance(original: MacroProfile, candidate: MacroProfile): MacroDistance {
    const caloriesPercent = this.calculatePercentDifference(original.caloriesKcal, candidate.caloriesKcal);
    const proteinPercent = this.calculatePercentDifference(original.proteinG, candidate.proteinG);
    const carbsPercent = this.calculatePercentDifference(original.carbsG, candidate.carbsG);
    const fatPercent = this.calculatePercentDifference(original.fatG, candidate.fatG);
    
    const fiberPercent = (original.fiberG && candidate.fiberG) 
      ? this.calculatePercentDifference(original.fiberG, candidate.fiberG)
      : undefined;
    
    const sugarPercent = (original.sugarG && candidate.sugarG)
      ? this.calculatePercentDifference(original.sugarG, candidate.sugarG)
      : undefined;

    // Calculate weighted overall score (calories and macros are equally important)
    const overallScore = (caloriesPercent + proteinPercent + carbsPercent + fatPercent) / 4;

    return {
      caloriesPercent,
      proteinPercent,
      carbsPercent,
      fatPercent,
      fiberPercent,
      sugarPercent,
      overallScore,
    };
  }

  /**
   * Calculate percentage difference between two values
   */
  private calculatePercentDifference(original: number, candidate: number): number {
    if (original === 0) {
      return candidate === 0 ? 0 : 100;
    }
    return Math.abs((candidate - original) / original) * 100;
  }

  /**
   * Calculate comprehensive score for a substitution candidate
   */
  private async calculateScore(
    originalFood: FoodItem,
    candidateFood: FoodItem,
    macroDistance: MacroDistance,
    preferences?: UserPreferences
  ): Promise<SubstitutionScore> {
    // Macro score (0-100, higher is better)
    // Invert the distance score since lower distance is better
    const macroScore = Math.max(0, 100 - macroDistance.overallScore * 2);

    // Preference score (0-100, higher is better)
    const preferenceScore = this.calculatePreferenceScore(candidateFood, preferences);

    // Availability/confidence score (0-100, higher is better)
    const availabilityScore = this.calculateAvailabilityScore(candidateFood);

    // Cost score (0-100, higher is better) - simplified for now
    const costScore = this.calculateCostScore(candidateFood);

    // Weighted total score
    const weights = {
      macro: 0.5,      // Macro similarity is most important
      preference: 0.2, // Preference alignment
      availability: 0.2, // Data quality/availability
      cost: 0.1,       // Cost efficiency
    };

    const totalScore = 
      macroScore * weights.macro +
      preferenceScore * weights.preference +
      availabilityScore * weights.availability +
      costScore * weights.cost;

    return {
      macroScore,
      preferenceScore,
      availabilityScore,
      costScore,
      totalScore,
      macroDistance,
    };
  }

  /**
   * Calculate preference alignment score
   */
  private calculatePreferenceScore(food: FoodItem, preferences?: UserPreferences): number {
    if (!preferences) {
      return 80; // Neutral score when no preferences
    }

    let score = 80;

    // Bonus for preferred cuisines
    if (preferences.cuisine && food.metadata?.categories) {
      const hasPreferredCuisine = preferences.cuisine.some(cuisine =>
        food.metadata!.categories!.some(cat => cat.includes(cuisine.toLowerCase()))
      );
      if (hasPreferredCuisine) {
        score += 20;
      }
    }

    return Math.min(100, score);
  }

  /**
   * Calculate availability/data quality score
   */
  private calculateAvailabilityScore(food: FoodItem): number {
    const confidence = food.metadata?.confidence || 0.7;
    const sourceQuality = this.getSourceQualityScore(food.metadata?.source);
    
    return Math.min(100, (confidence * 100 + sourceQuality) / 2);
  }

  /**
   * Get quality score for data source
   */
  private getSourceQualityScore(source?: string): number {
    switch (source) {
      case 'usda_fdc': return 95;
      case 'local': return 90;
      case 'open_food_facts': return 75;
      case 'user_contributed': return 60;
      default: return 70;
    }
  }

  /**
   * Calculate cost efficiency score (simplified)
   */
  private calculateCostScore(food: FoodItem): number {
    // This is a simplified cost model
    // In a real system, you'd integrate with pricing APIs or databases
    
    // Assume basic foods are more cost-effective
    const basicFoods = ['rice', 'beans', 'pasta', 'bread', 'oats', 'potatoes'];
    const foodNameLower = food.name.toLowerCase();
    
    const isBasicFood = basicFoods.some(basic => foodNameLower.includes(basic));
    
    return isBasicFood ? 85 : 70;
  }

  /**
   * Generate human-readable reason for substitution
   */
  private generateSubstitutionReason(
    original: FoodItem,
    candidate: FoodItem,
    macroDistance: MacroDistance
  ): string {
    const distanceDescription = macroDistance.overallScore < 2 
      ? "very similar macros"
      : macroDistance.overallScore < 5 
        ? "similar macros"
        : "acceptable macro profile";

    const source = candidate.metadata?.source;
    const sourceDescription = source === 'usda_fdc' 
      ? " (USDA verified)"
      : source === 'local'
        ? " (curated database)"
        : "";

    return `${candidate.name} provides ${distanceDescription} to ${original.name}${sourceDescription}`;
  }
}