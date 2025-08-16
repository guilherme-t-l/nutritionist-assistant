import { getNutritionService } from "./nutritionService";

export interface ValidationResult {
  isValid: boolean;
  score: number; // 0-1, higher is better
  issues: ValidationIssue[];
  suggestions: string[];
  safetyLevel: 'safe' | 'caution' | 'unsafe';
}

export interface ValidationIssue {
  type: 'safety' | 'accuracy' | 'scope' | 'format' | 'medical';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  suggestion?: string;
}

export interface ResponseMetrics {
  relevanceScore: number; // 0-1
  accuracyScore: number; // 0-1
  safetyScore: number; // 0-1
  completenessScore: number; // 0-1
  overallScore: number; // 0-1
  dataSourcesUsed: string[];
  nutritionClaimsCount: number;
  disclaimerPresent: boolean;
}

export class ResponseValidator {
  private nutritionService = getNutritionService();
  
  // Keywords that indicate medical advice (should trigger warnings)
  private medicalKeywords = [
    'diagnose', 'cure', 'treat', 'therapy', 'medicine', 'medication', 'prescription',
    'disease', 'disorder', 'syndrome', 'condition', 'symptoms', 'treatment',
    'medical advice', 'doctor', 'physician', 'healthcare', 'supplement'
  ];

  // Dangerous nutrition advice patterns
  private dangerousPatterns = [
    /under (\d+) calories?/i,
    /fast(?:ing)? for (\d+) days?/i,
    /eliminate all (carbs?|fats?|proteins?)/i,
    /only eat \w+/i,
    /raw meat/i,
    /unpasteurized/i
  ];

  // Required disclaimers for certain topics
  private disclaimerTriggers = [
    'weight loss', 'medical', 'supplement', 'pregnancy', 'diabetes', 
    'heart disease', 'allergy', 'medication', 'health condition'
  ];

  /**
   * Validate a complete response for safety, accuracy, and scope
   */
  async validateResponse(
    response: string, 
    userQuery: string,
    context?: {
      preferences?: any;
      planDoc?: string;
    }
  ): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];
    let score = 1.0;

    // 1. Safety validation
    const safetyValidation = this.validateSafety(response);
    if (safetyValidation.issues.length > 0) {
      issues.push(...safetyValidation.issues);
      score *= safetyValidation.scoreMultiplier;
    }

    // 2. Medical advice detection
    const medicalValidation = this.detectMedicalAdvice(response);
    if (medicalValidation.issues.length > 0) {
      issues.push(...medicalValidation.issues);
      score *= medicalValidation.scoreMultiplier;
    }

    // 3. Scope validation (nutrition-related content)
    const scopeValidation = this.validateScope(response, userQuery);
    if (scopeValidation.issues.length > 0) {
      issues.push(...scopeValidation.issues);
      score *= scopeValidation.scoreMultiplier;
    }

    // 4. Fact-checking nutritional claims
    const factCheckResult = await this.factCheckNutritionClaims(response);
    if (factCheckResult.issues.length > 0) {
      issues.push(...factCheckResult.issues);
      score *= factCheckResult.scoreMultiplier;
    }

    // 5. Disclaimer validation
    const disclaimerValidation = this.validateDisclaimers(response);
    if (disclaimerValidation.issues.length > 0) {
      issues.push(...disclaimerValidation.issues);
      score *= disclaimerValidation.scoreMultiplier;
    }

    // 6. Allergy safety check
    if (context?.preferences?.allergies) {
      const allergyValidation = this.validateAllergyCompliance(response, context.preferences.allergies);
      if (allergyValidation.issues.length > 0) {
        issues.push(...allergyValidation.issues);
        score *= allergyValidation.scoreMultiplier;
      }
    }

    // Determine safety level
    const criticalIssues = issues.filter(i => i.severity === 'critical');
    const highIssues = issues.filter(i => i.severity === 'high');
    
    let safetyLevel: 'safe' | 'caution' | 'unsafe';
    if (criticalIssues.length > 0) {
      safetyLevel = 'unsafe';
    } else if (highIssues.length > 0) {
      safetyLevel = 'caution';
    } else {
      safetyLevel = 'safe';
    }

    // Generate suggestions for improvement
    const suggestions = this.generateSuggestions(issues);

    return {
      isValid: score > 0.6 && safetyLevel !== 'unsafe',
      score: Math.max(0, Math.min(1, score)),
      issues,
      suggestions,
      safetyLevel,
    };
  }

  /**
   * Calculate comprehensive response metrics
   */
  async calculateMetrics(
    response: string,
    userQuery: string,
    context?: any
  ): Promise<ResponseMetrics> {
    // Relevance score based on keyword matching and context
    const relevanceScore = this.calculateRelevanceScore(response, userQuery);
    
    // Accuracy score based on fact-checking
    const accuracyResult = await this.factCheckNutritionClaims(response);
    const accuracyScore = accuracyResult.scoreMultiplier;
    
    // Safety score based on safety validation
    const safetyResult = this.validateSafety(response);
    const safetyScore = safetyResult.scoreMultiplier;
    
    // Completeness score based on response depth and actionability
    const completenessScore = this.calculateCompletenessScore(response, userQuery);
    
    // Data sources mentioned in response
    const dataSourcesUsed = this.extractDataSources(response);
    
    // Count nutrition claims made
    const nutritionClaimsCount = this.countNutritionClaims(response);
    
    // Check for appropriate disclaimers
    const disclaimerPresent = this.hasAppropriateDisclaimer(response);
    
    // Calculate overall score
    const overallScore = (relevanceScore + accuracyScore + safetyScore + completenessScore) / 4;

    return {
      relevanceScore,
      accuracyScore,
      safetyScore,
      completenessScore,
      overallScore,
      dataSourcesUsed,
      nutritionClaimsCount,
      disclaimerPresent,
    };
  }

  /**
   * Private validation methods
   */
  private validateSafety(response: string): { issues: ValidationIssue[]; scoreMultiplier: number } {
    const issues: ValidationIssue[] = [];
    let scoreMultiplier = 1.0;

    // Check for dangerous patterns
    for (const pattern of this.dangerousPatterns) {
      if (pattern.test(response)) {
        issues.push({
          type: 'safety',
          severity: 'critical',
          message: 'Response contains potentially dangerous nutrition advice',
          suggestion: 'Remove extreme dietary recommendations and add safety disclaimers',
        });
        scoreMultiplier *= 0.3;
      }
    }

    // Check for extremely low calorie recommendations
    const calorieMatches = response.match(/(\d+)\s*calories?/gi);
    if (calorieMatches) {
      for (const match of calorieMatches) {
        const calories = parseInt(match.match(/\d+/)![0]);
        if (calories < 800) {
          issues.push({
            type: 'safety',
            severity: 'high',
            message: 'Extremely low calorie recommendation detected',
            suggestion: 'Ensure calorie recommendations are within safe ranges (typically 1200+ for women, 1500+ for men)',
          });
          scoreMultiplier *= 0.7;
        }
      }
    }

    return { issues, scoreMultiplier };
  }

  private detectMedicalAdvice(response: string): { issues: ValidationIssue[]; scoreMultiplier: number } {
    const issues: ValidationIssue[] = [];
    let scoreMultiplier = 1.0;

    const lowerResponse = response.toLowerCase();
    const detectedKeywords = this.medicalKeywords.filter(keyword => 
      lowerResponse.includes(keyword.toLowerCase())
    );

    if (detectedKeywords.length > 0) {
      // Check if appropriate disclaimers are present
      const hasDisclaimer = lowerResponse.includes('consult') || 
                           lowerResponse.includes('healthcare') || 
                           lowerResponse.includes('doctor') ||
                           lowerResponse.includes('medical professional');

      if (!hasDisclaimer) {
        issues.push({
          type: 'medical',
          severity: 'high',
          message: 'Medical terminology detected without appropriate disclaimers',
          suggestion: 'Add disclaimer to consult healthcare professionals for medical advice',
        });
        scoreMultiplier *= 0.8;
      }
    }

    return { issues, scoreMultiplier };
  }

  private validateScope(response: string, userQuery: string): { issues: ValidationIssue[]; scoreMultiplier: number } {
    const issues: ValidationIssue[] = [];
    let scoreMultiplier = 1.0;

    const nutritionKeywords = [
      'nutrition', 'food', 'meal', 'diet', 'calorie', 'protein', 'carb', 'fat',
      'vitamin', 'mineral', 'fiber', 'recipe', 'ingredient', 'macro', 'eating'
    ];

    const responseWords = response.toLowerCase().split(/\s+/);
    const nutritionWordCount = responseWords.filter(word => 
      nutritionKeywords.some(keyword => word.includes(keyword))
    ).length;

    const relevanceRatio = nutritionWordCount / responseWords.length;

    if (relevanceRatio < 0.1) {
      issues.push({
        type: 'scope',
        severity: 'medium',
        message: 'Response appears to be off-topic for nutrition assistance',
        suggestion: 'Focus response on nutrition, food, or meal-related content',
      });
      scoreMultiplier *= 0.8;
    }

    return { issues, scoreMultiplier };
  }

  private async factCheckNutritionClaims(response: string): Promise<{ issues: ValidationIssue[]; scoreMultiplier: number }> {
    const issues: ValidationIssue[] = [];
    let scoreMultiplier = 1.0;

    // Extract specific nutrition claims (simplified implementation)
    const claims = this.extractNutritionClaims(response);
    
    // For now, we'll do basic validation
    // In a full implementation, this would cross-reference with the nutrition database
    for (const claim of claims) {
      if (this.isQuestionableClaim(claim)) {
        issues.push({
          type: 'accuracy',
          severity: 'medium',
          message: `Potentially inaccurate nutrition claim: "${claim}"`,
          suggestion: 'Verify nutrition claims against reliable databases',
        });
        scoreMultiplier *= 0.9;
      }
    }

    return { issues, scoreMultiplier };
  }

  private validateDisclaimers(response: string): { issues: ValidationIssue[]; scoreMultiplier: number } {
    const issues: ValidationIssue[] = [];
    let scoreMultiplier = 1.0;

    const needsDisclaimer = this.disclaimerTriggers.some(trigger => 
      response.toLowerCase().includes(trigger)
    );

    if (needsDisclaimer) {
      const hasDisclaimer = response.toLowerCase().includes('consult') ||
                           response.toLowerCase().includes('healthcare') ||
                           response.toLowerCase().includes('not medical advice');

      if (!hasDisclaimer) {
        issues.push({
          type: 'medical',
          severity: 'medium',
          message: 'Response discusses medical topics without appropriate disclaimers',
          suggestion: 'Add disclaimer about consulting healthcare professionals',
        });
        scoreMultiplier *= 0.85;
      }
    }

    return { issues, scoreMultiplier };
  }

  private validateAllergyCompliance(response: string, allergies: string[]): { issues: ValidationIssue[]; scoreMultiplier: number } {
    const issues: ValidationIssue[] = [];
    let scoreMultiplier = 1.0;

    for (const allergy of allergies) {
      const allergyRegex = new RegExp(`\\b${allergy.toLowerCase()}\\b`, 'i');
      if (allergyRegex.test(response)) {
        issues.push({
          type: 'safety',
          severity: 'critical',
          message: `Response mentions allergen: ${allergy}`,
          suggestion: `Remove or replace mentions of ${allergy} with allergy-safe alternatives`,
        });
        scoreMultiplier *= 0.2; // Very severe penalty for allergy violations
      }
    }

    return { issues, scoreMultiplier };
  }

  // Helper methods
  private calculateRelevanceScore(response: string, userQuery: string): number {
    // Simple keyword overlap calculation
    const queryWords = userQuery.toLowerCase().split(/\s+/);
    const responseWords = response.toLowerCase().split(/\s+/);
    
    const overlap = queryWords.filter(word => 
      responseWords.some(rWord => rWord.includes(word) || word.includes(rWord))
    ).length;
    
    return Math.min(1, overlap / queryWords.length);
  }

  private calculateCompletenessScore(response: string, userQuery: string): number {
    let score = 0.5; // Base score
    
    // Check for actionable content
    if (/\b(try|consider|recommend|suggest|add|include)\b/i.test(response)) score += 0.2;
    
    // Check for specific details
    if (/\d+\s*(g|ml|cup|tbsp|piece)/i.test(response)) score += 0.1;
    
    // Check for balanced information
    if (response.length > 100) score += 0.1;
    
    // Check for explanations
    if (/\b(because|since|due to|reason)\b/i.test(response)) score += 0.1;
    
    return Math.min(1, score);
  }

  private extractDataSources(response: string): string[] {
    const sources: string[] = [];
    
    if (/local database|food database/i.test(response)) sources.push('local_database');
    if (/open food facts/i.test(response)) sources.push('open_food_facts');
    if (/usda|food data central/i.test(response)) sources.push('usda_fdc');
    if (/nutrition service/i.test(response)) sources.push('nutrition_service');
    
    return sources;
  }

  private countNutritionClaims(response: string): number {
    const claimPatterns = [
      /\d+\s*calories?/gi,
      /\d+\s*g\s*(protein|carb|fat|fiber)/gi,
      /(high|low|rich|good source)\s+in\s+\w+/gi,
      /(contains?|provides?)\s+\d+/gi,
    ];
    
    let count = 0;
    for (const pattern of claimPatterns) {
      const matches = response.match(pattern);
      if (matches) count += matches.length;
    }
    
    return count;
  }

  private hasAppropriateDisclaimer(response: string): boolean {
    const disclaimers = [
      'consult',
      'healthcare',
      'medical professional',
      'not medical advice',
      'see a doctor',
      'speak with'
    ];
    
    return disclaimers.some(disclaimer => 
      response.toLowerCase().includes(disclaimer)
    );
  }

  private extractNutritionClaims(response: string): string[] {
    // Extract sentences that make specific nutrition claims
    const sentences = response.split(/[.!?]+/);
    return sentences.filter(sentence => 
      /\d+\s*(calorie|gram|protein|carb|fat|vitamin|mineral)/i.test(sentence)
    );
  }

  private isQuestionableClaim(claim: string): boolean {
    // Basic checks for obviously wrong claims
    const questionablePatterns = [
      /\d{4,}\s*calories/, // Extremely high calorie claims
      /0\s*calories.*(?:meat|cheese|nuts)/, // Zero calorie claims for high-calorie foods
      /100.*protein/, // 100% protein claims
    ];
    
    return questionablePatterns.some(pattern => pattern.test(claim));
  }

  private generateSuggestions(issues: ValidationIssue[]): string[] {
    const suggestions = issues
      .filter(issue => issue.suggestion)
      .map(issue => issue.suggestion!)
      .filter((suggestion, index, arr) => arr.indexOf(suggestion) === index); // Remove duplicates
    
    return suggestions;
  }
}

// Singleton instance
let responseValidator: ResponseValidator | null = null;

export function getResponseValidator(): ResponseValidator {
  if (!responseValidator) {
    responseValidator = new ResponseValidator();
  }
  return responseValidator;
}