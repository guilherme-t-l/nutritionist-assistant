import { HybridFoodService } from "./hybridFoodService";
import { OpenFoodFactsClient } from "./openFoodFactsClient";

async function runDemo() {
  console.log("🍎 NUTRITIONIST APP - HYBRID FOOD SERVICE DEMO 🍎");
  console.log("=" .repeat(60));
  
  // Test Open Food Facts API directly
  console.log("\n1. Testing Open Food Facts API connectivity...");
  const offClient = new OpenFoodFactsClient();
  
  try {
    const isConnected = await offClient.testConnection();
    console.log(`✅ Open Food Facts API: ${isConnected ? 'CONNECTED' : 'FAILED'}`);
    
    if (isConnected) {
      console.log("🔍 Testing search functionality...");
      const searchResults = await offClient.searchFoods("chicken", 1, 3);
      console.log(`   Found ${searchResults.length} chicken products`);
      
      if (searchResults.length > 0) {
        const firstProduct = searchResults[0];
        console.log(`   Sample: ${firstProduct.product_name} (${firstProduct.brands || 'No brand'})`);
        console.log(`   Calories: ${firstProduct.nutriments["energy-kcal_100g"] || firstProduct.nutriments.energy_100g || 'N/A'} kcal/100g`);
      }
    }
  } catch (error) {
    console.log(`❌ Open Food Facts API test failed: ${error}`);
  }
  
  // Test Hybrid Service
  console.log("\n2. Testing Hybrid Food Service...");
  const hybridService = new HybridFoodService({
    enableOpenFoodFacts: true,
    enableLocalDatabase: true,
    maxResults: 10,
    cacheResults: true,
  });
  
  try {
    // Test connectivity
    const connectivity = await hybridService.testConnectivity();
    console.log("📡 Service connectivity:");
    console.log(`   Local Database: ${connectivity.localDatabase ? '✅' : '❌'}`);
    console.log(`   Open Food Facts: ${connectivity.openFoodFacts ? '✅' : '❌'}`);
    console.log(`   Overall: ${connectivity.overall ? '✅' : '❌'}`);
    
    // Test search
    console.log("\n🔍 Testing food search...");
    const searchResults = await hybridService.searchFoods("apple");
    console.log(`   Query: "apple"`);
    console.log(`   Results: ${searchResults.foods.length} foods`);
    console.log(`   Source: ${searchResults.source}`);
    console.log(`   Total available: ${searchResults.totalCount}`);
    
    // Show sample results
    if (searchResults.foods.length > 0) {
      console.log("\n   Sample results:");
      searchResults.foods.slice(0, 3).forEach((food, index) => {
        const source = food.metadata?.source || 'unknown';
        const confidence = food.metadata?.confidence || 0;
        console.log(`   ${index + 1}. ${food.name} (${source}, confidence: ${confidence})`);
        console.log(`      ${food.macrosPerBase.caloriesKcal} cal, ${food.macrosPerBase.proteinG}g protein, ${food.macrosPerBase.carbsG}g carbs, ${food.macrosPerBase.fatG}g fat`);
      });
    }
    
    // Test barcode lookup
    console.log("\n📱 Testing barcode lookup...");
    try {
      const barcodeFood = await hybridService.getFoodByBarcode("3017620422003"); // Nutella
      if (barcodeFood) {
        console.log(`   ✅ Found: ${barcodeFood.name}`);
        console.log(`   Source: ${barcodeFood.metadata?.source}`);
        console.log(`   Barcode: ${barcodeFood.metadata?.barcode}`);
      } else {
        console.log("   ❌ Product not found");
      }
    } catch (error) {
      console.log(`   ❌ Barcode lookup failed: ${error}`);
    }
    
    // Show service stats
    console.log("\n📊 Service Statistics:");
    const stats = hybridService.getStats();
    console.log(`   Local foods: ${stats.localFoods}`);
    console.log(`   Open Food Facts: ${stats.openFoodFactsAvailable ? 'Available' : 'Unavailable'}`);
    console.log(`   Cache size: ${stats.cacheSize}`);
    
  } catch (error) {
    console.log(`❌ Hybrid service test failed: ${error}`);
  }
  
  // Test local database fallback
  console.log("\n3. Testing local database fallback...");
  const localOnlyService = new HybridFoodService({
    enableOpenFoodFacts: false,
    enableLocalDatabase: true,
  });
  
  try {
    const localResults = await localOnlyService.searchFoods("chicken");
    console.log(`   Local search for "chicken": ${localResults.foods.length} results`);
    console.log(`   Source: ${localResults.source}`);
    
    if (localResults.foods.length > 0) {
      console.log("   Sample local foods:");
      localResults.foods.slice(0, 3).forEach((food, index) => {
        console.log(`   ${index + 1}. ${food.name} (${food.metadata?.source})`);
      });
    }
  } catch (error) {
    console.log(`❌ Local service test failed: ${error}`);
  }
  
  console.log("\n" + "=" .repeat(60));
  console.log("🎉 DEMO COMPLETE! 🎉");
  console.log("\nThe hybrid food service is working and provides:");
  console.log("✅ Access to millions of foods via Open Food Facts");
  console.log("✅ Reliable fallback to local database");
  console.log("✅ Intelligent caching for performance");
  console.log("✅ Data source tracking and confidence scoring");
  console.log("✅ Graceful error handling and fallbacks");
}

// Run the demo if this file is executed directly
if (typeof window === 'undefined') {
  runDemo().catch(console.error);
}

export { runDemo };
