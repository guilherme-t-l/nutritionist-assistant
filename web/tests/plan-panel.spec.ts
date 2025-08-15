import { test, expect } from '@playwright/test';
import { getMealSection, getMealItemRow } from './utils/test-helpers';

test.describe('Plan Panel Component', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display plan panel elements', async ({ page }) => {
    // Check panel title
    await expect(page.getByText('Plan & Macros')).toBeVisible();
    
    // Check add item form
    await expect(page.getByRole('combobox', { name: 'Meal' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Food' })).toBeVisible();
    await expect(page.getByRole('spinbutton', { name: 'Quantity' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Unit' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Item' })).toBeVisible();
  });

  test('should allow adding new items to meals', async ({ page }) => {
    const mealSelector = page.getByRole('combobox', { name: 'Meal' });
    const foodSelector = page.getByRole('combobox', { name: 'Food' });
    const quantityInput = page.getByRole('spinbutton', { name: 'Quantity' });
    const unitSelector = page.getByRole('combobox', { name: 'Unit' });
    const addButton = page.getByRole('button', { name: 'Add Item' });
    
    // Select meal
    await mealSelector.selectOption('Lunch');
    await expect(mealSelector).toHaveValue('Lunch');
    
    // Select food
    await foodSelector.selectOption('oats_rolled');
    await expect(foodSelector).toHaveValue('oats_rolled');
    
    // Set quantity
    await quantityInput.fill('150');
    await expect(quantityInput).toHaveValue('150');
    
    // Set unit
    await unitSelector.selectOption('g');
    await expect(unitSelector).toHaveValue('g');
    
    // Add item
    await addButton.click();
    
    // Check that item appears in Lunch section
    await expect(page.locator('text=Lunch').locator('..').locator('..').getByText('oats_rolled')).toBeVisible();
  });

  test('should display meal sections with proper structure', async ({ page }) => {
    // Check that all meal sections exist
    await expect(page.getByText('Breakfast')).toBeVisible();
    await expect(page.getByText('Lunch')).toBeVisible();
    await expect(page.getByText('Dinner')).toBeVisible();
    await expect(page.getByText('Snacks')).toBeVisible();
    
    // Check that each meal section has the proper structure
    const breakfastSection = page.locator('text=Breakfast').locator('..').locator('..');
    await expect(breakfastSection.locator('text=No items')).toBeVisible();
  });

  test('should allow editing existing items', async ({ page }) => {
    // First add an item
    const mealSelector = page.getByRole('combobox', { name: 'Meal' });
    const foodSelector = page.getByRole('combobox', { name: 'Food' });
    const addButton = page.getByRole('button', { name: 'Add Item' });
    
    await mealSelector.selectOption('Breakfast');
    await foodSelector.selectOption('milk_skim');
    await addButton.click();
    
    // Now edit the item
    const mealSection = getMealSection(page, 'Breakfast');
    const itemFoodSelector = mealSection.getByRole('combobox', { name: 'Food' }).first();
    const itemQuantityInput = mealSection.getByRole('spinbutton', { name: 'Quantity' }).first();
    
    // Change food
    await itemFoodSelector.selectOption('oats_rolled');
    await expect(itemFoodSelector).toHaveValue('oats_rolled');
    
    // Change quantity
    await itemQuantityInput.fill('200');
    await expect(itemQuantityInput).toHaveValue('200');
  });

  test('should allow removing items', async ({ page }) => {
    // First add an item
    const mealSelector = page.getByRole('combobox', { name: 'Meal' });
    const foodSelector = page.getByRole('combobox', { name: 'Food' });
    const addButton = page.getByRole('button', { name: 'Add Item' });
    
    await mealSelector.selectOption('Dinner');
    await foodSelector.selectOption('egg_whole');
    await addButton.click();
    
    // Check item exists
    const dinnerSection = getMealSection(page, 'Dinner');
    await expect(dinnerSection.getByText('egg_whole')).toBeVisible();
    
    // Remove the item
    const removeButton = dinnerSection.getByRole('button', { name: 'Remove' }).first();
    await removeButton.click();
    
    // Check item is removed
    await expect(dinnerSection.getByText('egg_whole')).not.toBeVisible();
    await expect(dinnerSection.getByText('No items')).toBeVisible();
  });

  test('should display macro calculations', async ({ page }) => {
    // Add an item to see macro calculations
    const mealSelector = page.getByRole('combobox', { name: 'Meal' });
    const foodSelector = page.getByRole('combobox', { name: 'Food' });
    const addButton = page.getByRole('button', { name: 'Add Item' });
    
    await mealSelector.selectOption('Breakfast');
    await foodSelector.selectOption('oats_rolled');
    await addButton.click();
    
    // Check that macro information is displayed
    const breakfastSection = getMealSection(page, 'Breakfast');
    await expect(breakfastSection.getByText(/kcal \d+/)).toBeVisible();
    await expect(breakfastSection.getByText(/P\d+\.\d+/)).toBeVisible();
    await expect(breakfastSection.getByText(/C\d+\.\d+/)).toBeVisible();
    await expect(breakfastSection.getByText(/F\d+\.\d+/)).toBeVisible();
  });

  test('should display daily totals', async ({ page }) => {
    // Check daily totals section exists
    await expect(page.getByText('Daily Total')).toBeVisible();
    
    // Check that totals are displayed (even if 0)
    await expect(page.getByText(/kcal \d+/)).toBeVisible();
    await expect(page.getByText(/Protein \d+\.\d+ g/)).toBeVisible();
    await expect(page.getByText(/Carbs \d+\.\d+ g/)).toBeVisible();
    await expect(page.getByText(/Fat \d+\.\d+ g/)).toBeVisible();
  });

  test('should handle different units correctly', async ({ page }) => {
    const mealSelector = page.getByRole('combobox', { name: 'Meal' });
    const foodSelector = page.getByRole('combobox', { name: 'Food' });
    const quantityInput = page.getByRole('spinbutton', { name: 'Quantity' });
    const unitSelector = page.getByRole('combobox', { name: 'Unit' });
    const addButton = page.getByRole('button', { name: 'Add Item' });
    
    // Test with grams
    await mealSelector.selectOption('Snacks');
    await foodSelector.selectOption('banana');
    await quantityInput.fill('100');
    await unitSelector.selectOption('g');
    await addButton.click();
    
    // Test with milliliters
    await mealSelector.selectOption('Lunch');
    await foodSelector.selectOption('milk_skim');
    await quantityInput.fill('250');
    await unitSelector.selectOption('ml');
    await addButton.click();
    
    // Test with pieces
    await mealSelector.selectOption('Dinner');
    await foodSelector.selectOption('egg_whole');
    await quantityInput.fill('2');
    await unitSelector.selectOption('piece');
    await addButton.click();
    
    // Verify all items were added
    await expect(page.locator('text=Snacks').locator('..').locator('..').getByText('banana')).toBeVisible();
    await expect(page.locator('text=Lunch').locator('..').locator('..').getByText('milk_skim')).toBeVisible();
    await expect(page.locator('text=Dinner').locator('..').locator('..').getByText('egg_whole')).toBeVisible();
  });

  test('should handle empty quantity gracefully', async ({ page }) => {
    const mealSelector = page.getByRole('combobox', { name: 'Meal' });
    const foodSelector = page.getByRole('combobox', { name: 'Food' });
    const addButton = page.getByRole('button', { name: 'Add Item' });
    
    // Try to add item with empty quantity
    await mealSelector.selectOption('Breakfast');
    await foodSelector.selectOption('oats_rolled');
    await addButton.click();
    
    // Should not add item with 0 quantity
    await expect(page.locator('text=Breakfast').locator('..').locator('..').getByText('No items')).toBeVisible();
  });
});
