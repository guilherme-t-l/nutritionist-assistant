import { NextRequest, NextResponse } from 'next/server';
import { getNutritionService } from '@/lib/llm/nutritionService';
import type { SubstitutionConstraints, FoodPortion } from '@/lib/nutrition/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { foodId, portion, constraints, options } = body;

    // Validate required fields
    if (!foodId || !portion) {
      return NextResponse.json(
        { error: 'Missing required fields: foodId and portion' },
        { status: 400 }
      );
    }

    // Validate portion format
    if (!portion.quantity || !portion.unit) {
      return NextResponse.json(
        { error: 'Portion must include quantity and unit' },
        { status: 400 }
      );
    }

    const nutritionService = getNutritionService();

    // Use smart substitutions if options are provided, otherwise basic substitutions
    const result = options?.mealContext || options?.userContext || options?.enableLLMRanking 
      ? await nutritionService.findSmartSubstitutions(foodId, portion, options)
      : await nutritionService.findSubstitutions(foodId, portion, constraints);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      source: result.source,
    });

  } catch (error) {
    console.error('Substitutions API error:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error',
        success: false 
      },
      { status: 500 }
    );
  }
}

// Handle GET requests for API documentation
export async function GET() {
  return NextResponse.json({
    name: 'Food Substitutions API',
    description: 'Find nutritionally similar food substitutions with macro tolerance',
    endpoints: {
      POST: {
        description: 'Find food substitutions',
        body: {
          foodId: 'string (required) - ID of the food to substitute',
          portion: {
            quantity: 'number (required) - Amount of food',
            unit: 'string (required) - Unit of measurement (g, ml, etc.)'
          },
          constraints: {
            macroTolerancePercent: 'number (optional, default: 5) - Max macro deviation %',
            maxSuggestions: 'number (optional, default: 10) - Max number of suggestions',
            minConfidence: 'number (optional, default: 0.7) - Min data confidence score',
            preferences: {
              allergies: 'string[] (optional) - Foods to avoid',
              dislikes: 'string[] (optional) - Foods user dislikes',
              dietaryRestrictions: 'string[] (optional) - Diet restrictions'
            }
          },
          options: {
            mealContext: 'string (optional) - Context about the meal',
            userContext: 'string (optional) - Additional user context',
            enableLLMRanking: 'boolean (optional, default: true) - Use AI for enhanced ranking'
          }
        },
        response: {
          success: 'boolean',
          data: {
            originalFood: 'FoodItem',
            originalPortion: 'FoodPortion',
            originalMacros: 'MacroProfile',
            candidates: 'SubstitutionCandidate[]',
            hasViableSubstitutions: 'boolean',
            metadata: 'object'
          }
        }
      }
    },
    examples: {
      basicSubstitution: {
        foodId: 'white_rice_cooked',
        portion: { quantity: 150, unit: 'g' },
        constraints: { macroTolerancePercent: 5 }
      },
      smartSubstitution: {
        foodId: 'chicken_breast_cooked',
        portion: { quantity: 150, unit: 'g' },
        constraints: {
          preferences: {
            allergies: ['dairy'],
            dietaryRestrictions: ['vegetarian']
          }
        },
        options: {
          mealContext: 'lunch protein for weight training',
          enableLLMRanking: true
        }
      }
    }
  });
}