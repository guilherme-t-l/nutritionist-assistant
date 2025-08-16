import { describe, it, expect, beforeEach } from 'vitest';
import { ResponseValidator } from '../responseValidator';

describe('ResponseValidator', () => {
  let validator: ResponseValidator;

  beforeEach(() => {
    validator = new ResponseValidator();
  });

  describe('Safety Validation', () => {
    it('should detect dangerous low-calorie recommendations', async () => {
      const dangerousResponse = 'You should eat under 500 calories per day for quick weight loss.';
      const result = await validator.validateResponse(dangerousResponse, 'How to lose weight?');
      
      expect(result.safetyLevel).toBe('unsafe');
      expect(result.isValid).toBe(false);
      expect(result.issues.length).toBeGreaterThanOrEqual(1);
      expect(result.issues[0].type).toBe('safety');
      expect(result.issues[0].severity).toMatch(/high|critical/);
    });

    it('should detect dangerous fasting recommendations', async () => {
      const dangerousResponse = 'Try fasting for 7 days to reset your metabolism.';
      const result = await validator.validateResponse(dangerousResponse, 'How to detox?');
      
      expect(result.safetyLevel).toBe('unsafe');
      expect(result.issues.some(issue => issue.type === 'safety' && issue.severity === 'critical')).toBe(true);
    });

    it('should detect dangerous elimination diet advice', async () => {
      const dangerousResponse = 'Eliminate all carbs from your diet permanently for best results.';
      const result = await validator.validateResponse(dangerousResponse, 'Diet advice?');
      
      expect(result.safetyLevel).toBe('unsafe');
      expect(result.issues.some(issue => issue.type === 'safety')).toBe(true);
    });

    it('should pass safe nutritional advice', async () => {
      const safeResponse = 'A balanced diet with 1800-2000 calories including whole grains, lean proteins, fruits and vegetables is generally healthy for most adults.';
      const result = await validator.validateResponse(safeResponse, 'Healthy diet advice?');
      
      expect(result.safetyLevel).toBe('safe');
      expect(result.isValid).toBe(true);
    });
  });

  describe('Medical Advice Detection', () => {
    it('should detect medical terminology without disclaimers', async () => {
      const medicalResponse = 'This supplement will cure your diabetes and reduce symptoms of heart disease.';
      const result = await validator.validateResponse(medicalResponse, 'Supplement question?');
      
      expect(result.issues.some(issue => issue.type === 'medical')).toBe(true);
      expect(result.score).toBeLessThan(1.0);
    });

    it('should accept medical terminology with proper disclaimers', async () => {
      const responsiveResponse = 'While nutrition can support health, you should consult your healthcare provider about managing diabetes and heart conditions.';
      const result = await validator.validateResponse(responsiveResponse, 'Health conditions?');
      
      expect(result.safetyLevel).toBe('safe');
      expect(result.isValid).toBe(true);
    });

    it('should require disclaimers for weight loss topics', async () => {
      const responseWithoutDisclaimer = 'For weight loss, cut calories to 1000 per day and take these supplements.';
      const result = await validator.validateResponse(responseWithoutDisclaimer, 'Weight loss help?');
      
      expect(result.issues.some(issue => issue.type === 'medical')).toBe(true);
    });
  });

  describe('Allergy Compliance', () => {
    it('should detect allergen violations', async () => {
      const allergyViolation = 'Try adding nuts and shellfish to your salad for extra protein.';
      const context = {
        preferences: {
          allergies: ['nuts', 'shellfish']
        }
      };
      
      const result = await validator.validateResponse(allergyViolation, 'Protein sources?', context);
      
      expect(result.safetyLevel).toBe('unsafe');
      expect(result.issues.some(issue => 
        issue.type === 'safety' && 
        issue.severity === 'critical' && 
        issue.message.includes('allergen')
      )).toBe(true);
    });

    it('should pass allergen-safe recommendations', async () => {
      const safeResponse = 'Try adding chicken breast and lentils to your salad for extra protein.';
      const context = {
        preferences: {
          allergies: ['nuts', 'shellfish']
        }
      };
      
      const result = await validator.validateResponse(safeResponse, 'Protein sources?', context);
      
      expect(result.safetyLevel).toBe('safe');
      expect(result.isValid).toBe(true);
    });
  });

  describe('Scope Validation', () => {
    it('should detect off-topic responses', async () => {
      const offTopicResponse = 'The weather today is sunny with a chance of rain. Here is the stock market report.';
      const result = await validator.validateResponse(offTopicResponse, 'Nutrition advice?');
      
      expect(result.issues.some(issue => issue.type === 'scope')).toBe(true);
      expect(result.score).toBeLessThan(1.0);
    });

    it('should pass nutrition-focused responses', async () => {
      const nutritionResponse = 'This meal provides 400 calories with 25g protein, 40g carbs, and 15g fat from chicken, rice, and vegetables.';
      const result = await validator.validateResponse(nutritionResponse, 'Meal macros?');
      
      expect(result.safetyLevel).toMatch(/safe|caution/);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Response Metrics Calculation', () => {
    it('should calculate comprehensive metrics', async () => {
      const response = 'This chicken breast contains 165 calories and 31g protein per 100g according to our food database.';
      const metrics = await validator.calculateMetrics(response, 'Chicken nutrition?');
      
      expect(metrics.relevanceScore).toBeGreaterThanOrEqual(0.5);
      expect(metrics.accuracyScore).toBeGreaterThan(0.8);
      expect(metrics.safetyScore).toBeGreaterThan(0.6);
      expect(metrics.completenessScore).toBeGreaterThan(0.5);
      expect(metrics.nutritionClaimsCount).toBeGreaterThan(0);
    });

    it('should detect data sources in responses', async () => {
      const response = 'According to our local database, this food contains 200 calories. The Open Food Facts database confirms this information.';
      const metrics = await validator.calculateMetrics(response, 'Food information?');
      
      expect(metrics.dataSourcesUsed).toContain('local_database');
      expect(metrics.dataSourcesUsed).toContain('open_food_facts');
    });

    it('should count nutrition claims accurately', async () => {
      const response = 'This contains 200 calories, 10g protein, 30g carbs, and 5g fat. It is high in fiber.';
      const metrics = await validator.calculateMetrics(response, 'Nutrition info?');
      
      expect(metrics.nutritionClaimsCount).toBeGreaterThanOrEqual(4);
    });

    it('should detect appropriate disclaimers', async () => {
      const responseWithDisclaimer = 'This nutrition advice is general information. Please consult a healthcare professional for medical concerns.';
      const metrics = await validator.calculateMetrics(responseWithDisclaimer, 'Health advice?');
      
      expect(metrics.disclaimerPresent).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty responses', async () => {
      const result = await validator.validateResponse('', 'Question?');
      
      expect(result.score).toBeLessThan(0.9); // Empty responses should have lower scores
      // Note: Empty responses may still be considered 'valid' in some contexts
    });

    it('should handle very long responses', async () => {
      const longResponse = 'This is nutritional information. '.repeat(100) + 'Consult healthcare professionals.';
      const result = await validator.validateResponse(longResponse, 'Nutrition info?');
      
      expect(result.isValid).toBe(true);
      expect(result.safetyLevel).toBe('safe');
    });

    it('should handle responses with special characters', async () => {
      const specialCharResponse = 'Nutrition info: 200kcal, 10g protein (20% DV), <5g sugar, >15g fiber!';
      const result = await validator.validateResponse(specialCharResponse, 'Nutrition question?');
      
      expect(result.isValid).toBe(true);
    });

    it('should handle null context gracefully', async () => {
      const response = 'Here is some nutrition advice about protein sources.';
      const result = await validator.validateResponse(response, 'Protein advice?', undefined);
      
      expect(result.isValid).toBe(true);
      expect(result.safetyLevel).toBe('safe');
    });
  });

  describe('Fact Checking', () => {
    it('should detect questionable nutrition claims', async () => {
      const questionableResponse = 'This food has 0 calories despite being made of nuts and cheese. It contains 5000 calories per gram.';
      const result = await validator.validateResponse(questionableResponse, 'Food info?');
      
      expect(result.issues.some(issue => issue.type === 'accuracy')).toBe(true);
    });

    it('should pass reasonable nutrition claims', async () => {
      const reasonableResponse = 'Chicken breast contains approximately 165 calories and 31g protein per 100g serving.';
      const result = await validator.validateResponse(reasonableResponse, 'Chicken nutrition?');
      
      expect(result.safetyLevel).toMatch(/safe|caution/);
      expect(result.isValid).toBe(true);
    });
  });
});