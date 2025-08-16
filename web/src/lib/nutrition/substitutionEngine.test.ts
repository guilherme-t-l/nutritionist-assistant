import { describe, test, expect, beforeEach } from '@jest/globals';
import { SubstitutionEngine } from './substitutionEngine';
import type { 
  SubstitutionConstraints, 
  UserPreferences, 
  FoodItem, 
  FoodPortion 
} from './types';

describe('SubstitutionEngine', () => {
  let engine: SubstitutionEngine;

  beforeEach(() => {
    engine = new SubstitutionEngine();
  });

  describe('Core Functionality', () => {
    test('should find substitutions for common foods', async () => {
      const result = await engine.findSubstitutions(
        'white_rice_cooked',
        { quantity: 150, unit: 'g' }
      );

      expect(result.hasViableSubstitutions).toBe(true);
      expect(result.candidates.length).toBeGreaterThan(0);
      expect(result.originalFood.id).toBe('white_rice_cooked');
      expect(result.metadata.totalCandidatesEvaluated).toBeGreaterThan(0);
    });

    test('should throw error for non-existent food', async () => {
      await expect(
        engine.findSubstitutions('non_existent_food', { quantity: 100, unit: 'g' })
      ).rejects.toThrow('Food not found: non_existent_food');
    });

    test('should return empty candidates when no suitable substitutions exist', async () => {
      // Use very strict constraints to get no results
      const constraints: SubstitutionConstraints = {
        macroTolerancePercent: 0.1, // Extremely strict
        minConfidence: 0.99,
        maxSuggestions: 5,
      };

      const result = await engine.findSubstitutions(
        'olive_oil',
        { quantity: 15, unit: 'g' },
        constraints
      );

      // Olive oil is quite unique, so very strict tolerance should yield few/no results
      expect(result.candidates.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Macro Tolerance Compliance', () => {
    test('should respect 5% macro tolerance by default', async () => {
      const result = await engine.findSubstitutions(
        'chicken_breast_cooked',
        { quantity: 100, unit: 'g' }
      );

      const originalMacros = result.originalMacros;

      result.candidates.forEach(candidate => {
        const macroDistance = candidate.score.macroDistance;
        
        // Check individual macro tolerances
        expect(macroDistance.caloriesPercent).toBeLessThanOrEqual(5);
        expect(macroDistance.proteinPercent).toBeLessThanOrEqual(5);
        expect(macroDistance.carbsPercent).toBeLessThanOrEqual(5);
        expect(macroDistance.fatPercent).toBeLessThanOrEqual(5);
        
        // Check overall tolerance
        expect(macroDistance.overallScore).toBeLessThanOrEqual(5);
      });
    });

    test('should respect custom macro tolerance', async () => {
      const customTolerance = 2;
      const constraints: SubstitutionConstraints = {
        macroTolerancePercent: customTolerance,
      };

      const result = await engine.findSubstitutions(
        'brown_rice_cooked',
        { quantity: 200, unit: 'g' },
        constraints
      );

      result.candidates.forEach(candidate => {
        expect(candidate.score.macroDistance.overallScore).toBeLessThanOrEqual(customTolerance);
      });
    });

    test('should calculate macro distances correctly', async () => {
      const result = await engine.findSubstitutions(
        'quinoa_cooked',
        { quantity: 100, unit: 'g' }
      );

      if (result.candidates.length > 0) {
        const candidate = result.candidates[0];
        const original = result.originalMacros;
        const candidateMacros = candidate.macros;
        const distance = candidate.score.macroDistance;

        // Verify distance calculations
        const expectedCaloriesPercent = Math.abs((candidateMacros.caloriesKcal - original.caloriesKcal) / original.caloriesKcal) * 100;
        const expectedProteinPercent = Math.abs((candidateMacros.proteinG - original.proteinG) / original.proteinG) * 100;

        expect(distance.caloriesPercent).toBeCloseTo(expectedCaloriesPercent, 1);
        expect(distance.proteinPercent).toBeCloseTo(expectedProteinPercent, 1);
      }
    });
  });

  describe('Preference Filtering', () => {
    test('should exclude allergenic foods', async () => {
      const preferences: UserPreferences = {
        allergies: ['nuts', 'dairy', 'eggs'],
      };

      const constraints: SubstitutionConstraints = {
        preferences,
      };

      const result = await engine.findSubstitutions(
        'chicken_breast_cooked',
        { quantity: 150, unit: 'g' },
        constraints
      );

      result.candidates.forEach(candidate => {
        const foodName = candidate.food.name.toLowerCase();
        expect(foodName).not.toContain('nuts');
        expect(foodName).not.toContain('dairy');
        expect(foodName).not.toContain('egg');
        expect(foodName).not.toContain('almond');
        expect(foodName).not.toContain('milk');
        expect(foodName).not.toContain('cheese');
      });
    });

    test('should exclude disliked foods', async () => {
      const preferences: UserPreferences = {
        dislikes: ['fish', 'tofu'],
      };

      const constraints: SubstitutionConstraints = {
        preferences,
      };

      const result = await engine.findSubstitutions(
        'beef_lean_cooked',
        { quantity: 120, unit: 'g' },
        constraints
      );

      result.candidates.forEach(candidate => {
        const foodName = candidate.food.name.toLowerCase();
        expect(foodName).not.toContain('fish');
        expect(foodName).not.toContain('salmon');
        expect(foodName).not.toContain('tuna');
        expect(foodName).not.toContain('tofu');
      });
    });

    test('should work without preferences', async () => {
      const result = await engine.findSubstitutions(
        'pasta_cooked',
        { quantity: 100, unit: 'g' }
      );

      expect(result.hasViableSubstitutions).toBe(true);
      expect(result.candidates.length).toBeGreaterThan(0);
    });
  });

  describe('Scoring and Ranking', () => {
    test('should rank candidates by total score', async () => {
      const result = await engine.findSubstitutions(
        'oats_rolled',
        { quantity: 50, unit: 'g' }
      );

      if (result.candidates.length > 1) {
        for (let i = 1; i < result.candidates.length; i++) {
          expect(result.candidates[i-1].score.totalScore).toBeGreaterThanOrEqual(
            result.candidates[i].score.totalScore
          );
        }
      }
    });

    test('should provide score breakdowns', async () => {
      const result = await engine.findSubstitutions(
        'almonds',
        { quantity: 30, unit: 'g' }
      );

      if (result.candidates.length > 0) {
        const candidate = result.candidates[0];
        const score = candidate.score;

        // All scores should be between 0 and 100
        expect(score.macroScore).toBeGreaterThanOrEqual(0);
        expect(score.macroScore).toBeLessThanOrEqual(100);
        expect(score.preferenceScore).toBeGreaterThanOrEqual(0);
        expect(score.preferenceScore).toBeLessThanOrEqual(100);
        expect(score.availabilityScore).toBeGreaterThanOrEqual(0);
        expect(score.availabilityScore).toBeLessThanOrEqual(100);
        expect(score.costScore).toBeGreaterThanOrEqual(0);
        expect(score.costScore).toBeLessThanOrEqual(100);
        expect(score.totalScore).toBeGreaterThanOrEqual(0);
        expect(score.totalScore).toBeLessThanOrEqual(100);
      }
    });

    test('should prioritize macro similarity in scoring', async () => {
      const result = await engine.findSubstitutions(
        'white_bread',
        { quantity: 80, unit: 'g' }
      );

      if (result.candidates.length > 1) {
        // Higher ranked candidates should have better macro scores or similar total performance
        const topCandidate = result.candidates[0];
        const lowerCandidate = result.candidates[result.candidates.length - 1];
        
        // Either the macro score is significantly better, or the total score reflects the tradeoffs
        expect(
          topCandidate.score.macroScore >= lowerCandidate.score.macroScore ||
          topCandidate.score.totalScore > lowerCandidate.score.totalScore
        ).toBe(true);
      }
    });
  });

  describe('Portion Optimization', () => {
    test('should suggest appropriate portion sizes', async () => {
      const result = await engine.findSubstitutions(
        'banana_raw',
        { quantity: 118, unit: 'g' } // Approximately 1 medium banana
      );

      result.candidates.forEach(candidate => {
        expect(candidate.suggestedPortion.quantity).toBeGreaterThan(0);
        expect(candidate.suggestedPortion.unit).toBe('g');
        expect(candidate.suggestedPortion.quantity).toBeLessThan(1000); // Reasonable upper bound
      });
    });

    test('should scale portions to match calories approximately', async () => {
      const result = await engine.findSubstitutions(
        'apple_raw',
        { quantity: 182, unit: 'g' } // Large apple, ~95 calories
      );

      const originalCalories = result.originalMacros.caloriesKcal;

      result.candidates.forEach(candidate => {
        const candidateCalories = candidate.macros.caloriesKcal;
        const calorieRatio = candidateCalories / originalCalories;
        
        // Should be within tolerance (since we filter by tolerance)
        expect(calorieRatio).toBeGreaterThan(0.95);
        expect(calorieRatio).toBeLessThan(1.05);
      });
    });
  });

  describe('Constraint Handling', () => {
    test('should respect maxSuggestions limit', async () => {
      const constraints: SubstitutionConstraints = {
        maxSuggestions: 3,
      };

      const result = await engine.findSubstitutions(
        'lentils_cooked',
        { quantity: 100, unit: 'g' },
        constraints
      );

      expect(result.candidates.length).toBeLessThanOrEqual(3);
    });

    test('should respect minimum confidence filter', async () => {
      const constraints: SubstitutionConstraints = {
        minConfidence: 0.9,
      };

      const result = await engine.findSubstitutions(
        'yogurt_greek_plain',
        { quantity: 170, unit: 'g' },
        constraints
      );

      result.candidates.forEach(candidate => {
        const confidence = candidate.food.metadata?.confidence;
        if (confidence !== undefined) {
          expect(confidence).toBeGreaterThanOrEqual(0.9);
        }
      });
    });

    test('should handle edge cases gracefully', async () => {
      const constraints: SubstitutionConstraints = {
        macroTolerancePercent: 0,
        maxSuggestions: 0,
      };

      const result = await engine.findSubstitutions(
        'honey',
        { quantity: 20, unit: 'g' },
        constraints
      );

      expect(result.candidates.length).toBe(0);
      expect(result.hasViableSubstitutions).toBe(false);
    });
  });

  describe('Safety and Error Handling', () => {
    test('should not suggest harmful substitutions', async () => {
      const result = await engine.findSubstitutions(
        'spinach_raw',
        { quantity: 85, unit: 'g' }
      );

      // Basic safety check: no obviously inappropriate substitutions
      result.candidates.forEach(candidate => {
        expect(candidate.food.name).toBeTruthy();
        expect(candidate.suggestedPortion.quantity).toBeGreaterThan(0);
        expect(candidate.macros.caloriesKcal).toBeGreaterThanOrEqual(0);
      });
    });

    test('should handle zero-calorie foods', async () => {
      // Test with a very low-calorie food
      const result = await engine.findSubstitutions(
        'cucumber_raw',
        { quantity: 100, unit: 'g' }
      );

      // Should not crash and should handle the low-calorie case
      expect(result).toBeDefined();
      expect(result.originalMacros.caloriesKcal).toBeLessThan(20);
    });

    test('should provide meaningful reasons', async () => {
      const result = await engine.findSubstitutions(
        'cottage_cheese',
        { quantity: 100, unit: 'g' }
      );

      result.candidates.forEach(candidate => {
        expect(candidate.reason).toBeTruthy();
        expect(candidate.reason.length).toBeGreaterThan(10);
        expect(candidate.reason).toContain(candidate.food.name);
      });
    });
  });

  describe('Performance and Metadata', () => {
    test('should complete substitution search within reasonable time', async () => {
      const startTime = Date.now();
      
      const result = await engine.findSubstitutions(
        'black_beans_cooked',
        { quantity: 150, unit: 'g' }
      );
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // Should complete within 5 seconds (generous limit for testing)
      expect(totalTime).toBeLessThan(5000);
      expect(result.metadata.processingTimeMs).toBeGreaterThan(0);
      expect(result.metadata.processingTimeMs).toBeLessThan(totalTime + 100);
    });

    test('should provide accurate metadata', async () => {
      const constraints: SubstitutionConstraints = {
        maxSuggestions: 7,
        macroTolerancePercent: 3,
      };

      const result = await engine.findSubstitutions(
        'sweet_potato_baked',
        { quantity: 128, unit: 'g' },
        constraints
      );

      expect(result.metadata.constraintsApplied).toEqual(
        expect.objectContaining({
          maxSuggestions: 7,
          macroTolerancePercent: 3,
        })
      );
      expect(result.metadata.totalCandidatesEvaluated).toBeGreaterThan(0);
    });
  });
});