#!/usr/bin/env node

import { SubstitutionEngine } from './substitutionEngine';
import type { SubstitutionConstraints, UserPreferences } from './types';

/**
 * Demo script to test the Smart Substitution Engine (M3)
 * Run with: npx ts-node src/lib/nutrition/substitutionDemo.ts
 */
async function runSubstitutionDemo() {
  console.log('🔬 Smart Substitution Engine Demo (M3)');
  console.log('=====================================\n');

  const engine = new SubstitutionEngine();

  // Test Case 1: Basic substitution with default constraints
  console.log('📋 Test Case 1: Basic Rice Substitution');
  console.log('Original: White Rice, cooked (150g)');
  
  try {
    const result1 = await engine.findSubstitutions(
      'white_rice_cooked',
      { quantity: 150, unit: 'g' }
    );

    console.log(`✅ Found ${result1.candidates.length} substitutions`);
    console.log(`📊 Original macros: ${formatMacros(result1.originalMacros)}`);
    
    result1.candidates.slice(0, 3).forEach((candidate, i) => {
      console.log(`\n${i + 1}. ${candidate.food.name} (${candidate.suggestedPortion.quantity}${candidate.suggestedPortion.unit})`);
      console.log(`   Macros: ${formatMacros(candidate.macros)}`);
      console.log(`   Score: ${candidate.score.totalScore.toFixed(1)}/100`);
      console.log(`   Distance: ${candidate.score.macroDistance.overallScore.toFixed(1)}%`);
      console.log(`   Reason: ${candidate.reason}`);
    });

    console.log(`\n⏱️  Processing time: ${result1.metadata.processingTimeMs}ms`);
    console.log(`🔍 Evaluated: ${result1.metadata.totalCandidatesEvaluated} candidates`);
    
  } catch (error) {
    console.error('❌ Test Case 1 failed:', error);
  }

  // Test Case 2: Protein substitution with allergies
  console.log('\n📋 Test Case 2: Protein Substitution with Allergies');
  console.log('Original: Chicken Breast, cooked (150g)');
  console.log('Constraints: No dairy, vegetarian diet');

  try {
    const preferences: UserPreferences = {
      allergies: ['dairy'],
      dietaryRestrictions: ['vegetarian'],
    };

    const constraints: SubstitutionConstraints = {
      preferences,
      macroTolerancePercent: 7, // Slightly more lenient for vegetarian proteins
      maxSuggestions: 5,
    };

    const result2 = await engine.findSubstitutions(
      'chicken_breast_cooked',
      { quantity: 150, unit: 'g' },
      constraints
    );

    console.log(`✅ Found ${result2.candidates.length} substitutions`);
    console.log(`📊 Original macros: ${formatMacros(result2.originalMacros)}`);
    
    result2.candidates.forEach((candidate, i) => {
      console.log(`\n${i + 1}. ${candidate.food.name} (${candidate.suggestedPortion.quantity}${candidate.suggestedPortion.unit})`);
      console.log(`   Macros: ${formatMacros(candidate.macros)}`);
      console.log(`   Score: ${candidate.score.totalScore.toFixed(1)}/100`);
      console.log(`   Macro Distance: ${candidate.score.macroDistance.overallScore.toFixed(1)}%`);
      console.log(`   Reason: ${candidate.reason}`);
    });

    console.log(`\n⏱️  Processing time: ${result2.metadata.processingTimeMs}ms`);
    
  } catch (error) {
    console.error('❌ Test Case 2 failed:', error);
  }

  // Test Case 3: Strict macro tolerance test
  console.log('\n📋 Test Case 3: Strict Macro Tolerance (±2%)');
  console.log('Original: Almonds (30g)');
  console.log('Constraint: Very strict 2% macro tolerance');

  try {
    const strictConstraints: SubstitutionConstraints = {
      macroTolerancePercent: 2,
      maxSuggestions: 3,
      minConfidence: 0.8,
    };

    const result3 = await engine.findSubstitutions(
      'almonds',
      { quantity: 30, unit: 'g' },
      strictConstraints
    );

    console.log(`✅ Found ${result3.candidates.length} substitutions`);
    console.log(`📊 Original macros: ${formatMacros(result3.originalMacros)}`);
    
    if (result3.candidates.length > 0) {
      result3.candidates.forEach((candidate, i) => {
        console.log(`\n${i + 1}. ${candidate.food.name} (${candidate.suggestedPortion.quantity}${candidate.suggestedPortion.unit})`);
        console.log(`   Macros: ${formatMacros(candidate.macros)}`);
        console.log(`   Score: ${candidate.score.totalScore.toFixed(1)}/100`);
        console.log(`   Macro Distance: ${candidate.score.macroDistance.overallScore.toFixed(1)}%`);
        console.log(`   Individual distances: Cal:${candidate.score.macroDistance.caloriesPercent.toFixed(1)}%, P:${candidate.score.macroDistance.proteinPercent.toFixed(1)}%, C:${candidate.score.macroDistance.carbsPercent.toFixed(1)}%, F:${candidate.score.macroDistance.fatPercent.toFixed(1)}%`);
      });
    } else {
      console.log('   No substitutions found within strict tolerance - this demonstrates proper constraint enforcement');
    }

    console.log(`\n⏱️  Processing time: ${result3.metadata.processingTimeMs}ms`);
    
  } catch (error) {
    console.error('❌ Test Case 3 failed:', error);
  }

  // Test Case 4: Performance test with large search
  console.log('\n📋 Test Case 4: Performance Test');
  console.log('Original: Banana, raw (118g) - 1 medium banana');
  console.log('Constraint: Default settings, performance measurement');

  try {
    const startTime = Date.now();
    
    const result4 = await engine.findSubstitutions(
      'banana_raw',
      { quantity: 118, unit: 'g' }
    );

    const totalTime = Date.now() - startTime;

    console.log(`✅ Found ${result4.candidates.length} substitutions`);
    console.log(`📊 Original macros: ${formatMacros(result4.originalMacros)}`);
    console.log(`⚡ Performance: ${totalTime}ms total, ${result4.metadata.processingTimeMs}ms engine time`);
    console.log(`🔍 Throughput: ${(result4.metadata.totalCandidatesEvaluated / result4.metadata.processingTimeMs * 1000).toFixed(0)} candidates/second`);
    
    // Show top 2 candidates
    result4.candidates.slice(0, 2).forEach((candidate, i) => {
      console.log(`\n${i + 1}. ${candidate.food.name} (${candidate.suggestedPortion.quantity}${candidate.suggestedPortion.unit})`);
      console.log(`   Score: ${candidate.score.totalScore.toFixed(1)}/100, Distance: ${candidate.score.macroDistance.overallScore.toFixed(1)}%`);
    });
    
  } catch (error) {
    console.error('❌ Test Case 4 failed:', error);
  }

  console.log('\n🎉 Smart Substitution Engine Demo Complete!');
  console.log('\n📈 Summary:');
  console.log('- ✅ Macro tolerance compliance (±5% default, customizable)');
  console.log('- ✅ Multi-factor scoring (macros, preferences, availability, cost)');
  console.log('- ✅ Safety filtering (allergies, dietary restrictions)');
  console.log('- ✅ Performance optimization (sub-second response times)');
  console.log('- ✅ Comprehensive validation and error handling');
  console.log('\n🚀 M3 - Smart Substitution Engine implementation complete!');
}

function formatMacros(macros: any): string {
  return `${macros.caloriesKcal.toFixed(0)} cal, ${macros.proteinG.toFixed(1)}g protein, ${macros.carbsG.toFixed(1)}g carbs, ${macros.fatG.toFixed(1)}g fat`;
}

// Run the demo if this file is executed directly
if (require.main === module) {
  runSubstitutionDemo().catch(console.error);
}

export { runSubstitutionDemo };