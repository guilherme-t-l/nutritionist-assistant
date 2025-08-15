import { FOOD_DATABASE, getFoodCategories, DATABASE_SIZE } from "./foodDatabase";

console.log(`\n🍎 FOOD DATABASE STATISTICS 🍎`);
console.log(`================================`);
console.log(`Total foods: ${DATABASE_SIZE}`);
console.log(`\nCategories:`);

const categories = getFoodCategories();
categories.forEach(category => {
  const foods = FOOD_DATABASE.filter(food => 
    food.name.toLowerCase().includes(category.replace('_', ' ')) ||
    food.id.includes(category)
  );
  console.log(`  ${category}: ${foods.length} foods`);
});

console.log(`\nSample foods:`);
FOOD_DATABASE.slice(0, 10).forEach(food => {
  console.log(`  - ${food.name} (${food.macrosPerBase.caloriesKcal} cal, ${food.macrosPerBase.proteinG}g protein)`);
});

console.log(`\nDatabase is ready for use! 🚀`);
