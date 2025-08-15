import { test, expect } from '@playwright/test';
import { 
  addMealItem, 
  sendChatMessage, 
  setPreferences, 
  switchProvider, 
  verifyMealItemExists,
  getDailyTotals, 
  verifyMealItemNotExists,
  getMealSection
} from './utils/test-helpers';

test.describe('Nutritionist Assistant Integration Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('complete nutrition planning workflow', async ({ page }) => {
    // Step 1: Set user preferences
    await setPreferences(page, {
      allergies: 'nuts, shellfish',
      dislikes: 'mushrooms, olives',
      cuisine: 'Mediterranean',
      budget: 'medium'
    });

    // Step 2: Add items to meal plan using the panel
    await addMealItem(page, 'Breakfast', 'oats_rolled', 50, 'g');
    await addMealItem(page, 'Breakfast', 'milk_skim', 240, 'ml');
    await addMealItem(page, 'Lunch', 'chicken_breast', 150, 'g');
    await addMealItem(page, 'Lunch', 'rice_brown', 100, 'g');
    await addMealItem(page, 'Dinner', 'salmon', 200, 'g');
    await addMealItem(page, 'Snacks', 'banana', 1, 'piece');

    // Step 3: Verify items were added correctly
    await verifyMealItemExists(page, 'Breakfast', 'oats_rolled');
    await verifyMealItemExists(page, 'Breakfast', 'milk_skim');
    await verifyMealItemExists(page, 'Lunch', 'chicken_breast');
    await verifyMealItemExists(page, 'Lunch', 'rice_brown');
    await verifyMealItemExists(page, 'Dinner', 'salmon');
    await verifyMealItemExists(page, 'Snacks', 'banana');

    // Step 4: Check that daily totals are calculated
    const totals = await getDailyTotals(page);
    expect(totals).not.toBeNull();
    expect(totals!.calories).toBeGreaterThan(0);
    expect(totals!.protein).toBeGreaterThan(0);
    expect(totals!.carbs).toBeGreaterThan(0);
    expect(totals!.fat).toBeGreaterThan(0);

    // Step 5: Test chat functionality with local model
    await switchProvider(page, 'webllm');
    await sendChatMessage(page, 'How can I improve this meal plan?');
    
    // Check that the message appears
    await expect(page.getByText('How can I improve this meal plan?')).toBeVisible();

    // Step 6: Test slash command functionality
    await sendChatMessage(page, '/add almonds 30g to snacks');
    
    // Check that the item was added via slash command
    await expect(page.getByText('Added to Snacks.')).toBeVisible();
    await verifyMealItemExists(page, 'Snacks', 'almonds');

    // Step 7: Test plan document editing
    const textarea = page.locator('textarea');
    const newPlan = `Meal Plan
    
Breakfast:
- oats_rolled 75 g
- milk_skim 300 ml

Lunch:
- chicken_breast 200 g
- rice_brown 150 g

Dinner:
- salmon 250 g
- broccoli 200 g

Snacks:
- banana 1 piece
- almonds 30 g`;

    await textarea.fill(newPlan);
    await expect(textarea).toHaveValue(newPlan);

    // Step 8: Verify updated totals reflect new plan
    const updatedTotals = await getDailyTotals(page);
    expect(updatedTotals).not.toBeNull();
    expect(updatedTotals!.calories).toBeGreaterThan(totals!.calories);
  });

  test('provider switching and model selection', async ({ page }) => {
    // Test WebLLM provider
    await switchProvider(page, 'webllm');
    await expect(page.getByRole('combobox', { name: 'Local model' })).toBeVisible();
    
    // Test different models
    const modelSelector = page.getByRole('combobox', { name: 'Local model' });
    await modelSelector.selectOption('Phi-3-mini-4k-instruct-q4f16_1-MLC');
    await expect(modelSelector).toHaveValue('Phi-3-mini-4k-instruct-q4f16_1-MLC');
    
    await modelSelector.selectOption('Qwen2-1.5B-Instruct-q4f16_1-MLC');
    await expect(modelSelector).toHaveValue('Qwen2-1.5B-Instruct-q4f16_1-MLC');
    
    // Switch to OpenAI
    await switchProvider(page, 'openai');
    await expect(page.getByRole('combobox', { name: 'Local model' })).not.toBeVisible();
    
    // Switch back to WebLLM
    await switchProvider(page, 'webllm');
    await expect(page.getByRole('combobox', { name: 'Local model' })).toBeVisible();
  });

  test('meal plan management workflow', async ({ page }) => {
    // Add items to different meals
    await addMealItem(page, 'Breakfast', 'oats_rolled', 100, 'g');
    await addMealItem(page, 'Lunch', 'chicken_breast', 200, 'g');
    await addMealItem(page, 'Dinner', 'salmon', 250, 'g');
    
    // Edit an existing item
    const breakfastSection = getMealSection(page, 'Breakfast');
    const itemQuantityInput = breakfastSection.getByRole('spinbutton', { name: 'Quantity' }).first();
    await itemQuantityInput.fill('150');
    await expect(itemQuantityInput).toHaveValue('150');
    
    // Remove an item
    const lunchSection = getMealSection(page, 'Lunch');
    const removeButton = lunchSection.getByRole('button', { name: 'Remove' }).first();
    await removeButton.click();
    await verifyMealItemNotExists(page, 'Lunch', 'chicken_breast');
    
    // Verify remaining items
    await verifyMealItemExists(page, 'Breakfast', 'oats_rolled');
    await verifyMealItemExists(page, 'Dinner', 'salmon');
  });

  test('chat and plan synchronization', async ({ page }) => {
    // Start with an empty plan
    const textarea = page.locator('textarea');
    await textarea.fill('');
    
    // Send a chat message requesting a meal plan
    await sendChatMessage(page, 'Create a healthy meal plan for me');
    
    // Check that the message appears
    await expect(page.getByText('Create a healthy meal plan for me')).toBeVisible();
    
    // Note: In a real test with actual LLM responses, you would verify that
    // the plan document gets updated with the AI-generated meal plan
  });

  test('error handling and edge cases', async ({ page }) => {
    // Test with invalid slash command
    await sendChatMessage(page, '/add invalid_command');
    
    // Should not process invalid commands
    await expect(page.getByText('Added to')).not.toBeVisible();
    
    // Test with empty preferences
    await setPreferences(page, {
      allergies: '',
      dislikes: '',
      cuisine: '',
      budget: ''
    });
    
    // Should still allow chat
    await sendChatMessage(page, 'Test message with empty preferences');
    await expect(page.getByText('Test message with empty preferences')).toBeVisible();
    
    // Test with very large quantities
    await addMealItem(page, 'Breakfast', 'oats_rolled', 9999, 'g');
    await verifyMealItemExists(page, 'Breakfast', 'oats_rolled');
    
    // Test with zero quantity
    await addMealItem(page, 'Lunch', 'chicken_breast', 0, 'g');
    // Should not add item with 0 quantity
    await verifyMealItemNotExists(page, 'Lunch', 'chicken_breast');
  });

  test('responsive design and mobile compatibility', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Verify key elements are still visible
    await expect(page.getByText('Nutritionist Assistant')).toBeVisible();
    await expect(page.getByPlaceholder('Type your message…')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send' })).toBeVisible();
    
    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    
    // Verify layout adjusts appropriately
    await expect(page.getByText('Plan Document')).toBeVisible();
    
    // Return to desktop viewport
    await page.setViewportSize({ width: 1280, height: 720 });
  });
});
