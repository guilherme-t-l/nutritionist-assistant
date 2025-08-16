import { NextRequest, NextResponse } from 'next/server';
import { OpenAIClient } from '@/lib/llm/openaiClient';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { context, model } = body;

    if (!context) {
      return NextResponse.json(
        { error: 'Missing required field: context' },
        { status: 400 }
      );
    }

    const openaiClient = new OpenAIClient();

    // Create a specialized prompt for substitution ranking
    const systemPrompt = `You are a professional nutritionist assistant specializing in food substitutions. 
Your task is to rank and analyze food substitution candidates based on nutritional value, practicality, and user context.

Guidelines:
- Prioritize macro similarity while considering overall nutritional value
- Consider meal context and user preferences heavily
- Factor in practicality (availability, preparation complexity)
- Provide clear, actionable reasoning
- Focus on health and nutritional benefits

Always respond with valid JSON only, no additional text.`;

    const userPrompt = `${context}

Please analyze these substitution candidates and provide a JSON response with rankings and insights.`;

    const response = await openaiClient.createCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], {
      model: model || 'gpt-3.5-turbo',
      temperature: 0.3, // Lower temperature for more consistent ranking
      maxTokens: 1000,
    });

    if (!response.success || !response.data?.content) {
      return NextResponse.json(
        { error: 'Failed to get LLM ranking response' },
        { status: 500 }
      );
    }

    // Parse the JSON response from the LLM
    let rankingResult;
    try {
      rankingResult = JSON.parse(response.data.content);
    } catch (parseError) {
      console.warn('Failed to parse LLM response as JSON:', response.data.content);
      
      // Fallback: return a basic response structure
      rankingResult = {
        rankings: [],
        insights: "Unable to parse LLM response, using default ranking"
      };
    }

    // Validate the response structure
    if (!rankingResult.rankings) {
      rankingResult.rankings = [];
    }
    if (!rankingResult.insights) {
      rankingResult.insights = "Ranking completed successfully";
    }

    return NextResponse.json({
      success: true,
      data: rankingResult,
      model: model || 'gpt-3.5-turbo',
      source: 'llm_ranking'
    });

  } catch (error) {
    console.error('LLM ranking API error:', error);
    
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
    name: 'LLM Substitution Ranking API',
    description: 'Use LLM to rank and analyze food substitution candidates',
    endpoints: {
      POST: {
        description: 'Rank substitution candidates using LLM analysis',
        body: {
          context: 'string (required) - Full context including original food, candidates, and user preferences',
          model: 'string (optional, default: gpt-3.5-turbo) - LLM model to use'
        },
        response: {
          success: 'boolean',
          data: {
            rankings: 'Array of ranking objects with position, originalIndex, and reasoning',
            insights: 'string - General insights about the substitution group'
          },
          model: 'string - Model used for ranking',
          source: 'string'
        }
      }
    },
    example: {
      context: `You are a nutritionist assistant helping rank food substitutions.

Original food: Chicken Breast, cooked (150g)
Original macros: 248 cal, 46.2g protein, 0.0g carbs, 5.4g fat

User preferences: {"allergies": ["dairy"], "dietaryRestrictions": ["none"]}

Top substitution candidates (ranked by algorithm):
1. Turkey Breast, cooked (142.3g)
   Macros: 235 cal, 43.8g protein, 0.1g carbs, 5.1g fat
   Score: 92.5/100
   Reason: Turkey Breast provides very similar macros to Chicken Breast (curated database)

Please analyze these substitutions and provide rankings.`,
      expectedResponse: {
        rankings: [
          {
            position: 1,
            originalIndex: 0,
            reasoning: "Excellent macro match with high-quality protein profile"
          }
        ],
        insights: "Turkey breast is an excellent substitute with nearly identical nutritional profile"
      }
    }
  });
}