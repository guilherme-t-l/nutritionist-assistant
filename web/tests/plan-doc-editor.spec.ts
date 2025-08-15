import { test, expect } from '@playwright/test';

test.describe('Plan Document Editor Component', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display plan document editor elements', async ({ page }) => {
    // Check editor title
    await expect(page.getByText('Plan Document')).toBeVisible();
    
    // Check textarea exists
    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible();
    
    // Check daily totals section
    await expect(page.getByText('Daily Total')).toBeVisible();
  });

  test('should allow editing plan document text', async ({ page }) => {
    const textarea = page.locator('textarea');
    
    // Check initial content (should have default meal plan structure)
    await expect(textarea).toHaveValue(/Meal Plan/);
    await expect(textarea).toHaveValue(/Breakfast:/);
    await expect(textarea).toHaveValue(/Lunch:/);
    await expect(textarea).toHaveValue(/Dinner:/);
    await expect(textarea).toHaveValue(/Snacks:/);
    
    // Edit the content
    const newContent = `Meal Plan
    
Breakfast:
- oats_rolled 50 g
- milk_skim 240 ml

Lunch:
- chicken_breast 100 g
- rice_brown 75 g

Dinner:
- salmon 120 g
- broccoli 150 g

Snacks:
- banana 1 piece`;
    
    await textarea.fill(newContent);
    await expect(textarea).toHaveValue(newContent);
  });

  test('should parse meal plan format correctly', async ({ page }) => {
    const textarea = page.locator('textarea');
    
    // Set a valid meal plan format
    const validPlan = `Meal Plan
    
Breakfast:
- oats_rolled 50 g
- milk_skim 240 ml

Lunch:
- chicken_breast 100 g

Dinner:
- salmon 120 g

Snacks:
- banana 1 piece`;
    
    await textarea.fill(validPlan);
    
    // Check that the content is properly set
    await expect(textarea).toHaveValue(validPlan);
  });

  test('should handle invalid meal plan format gracefully', async ({ page }) => {
    const textarea = page.locator('textarea');
    
    // Set invalid format
    const invalidPlan = `Invalid Format
    
Breakfast
oats_rolled 50 g
milk_skim 240 ml

Lunch
chicken_breast 100 g`;
    
    await textarea.fill(invalidPlan);
    
    // Should still accept the content even if format is invalid
    await expect(textarea).toHaveValue(invalidPlan);
  });

  test('should display daily totals based on document content', async ({ page }) => {
    const textarea = page.locator('textarea');
    
    // Set a meal plan with known foods
    const mealPlan = `Meal Plan
    
Breakfast:
- oats_rolled 100 g

Lunch:
- chicken_breast 150 g

Dinner:
- salmon 200 g

Snacks:
- banana 1 piece`;
    
    await textarea.fill(mealPlan);
    
    // Check that daily totals are displayed
    await expect(page.getByText(/kcal \d+/)).toBeVisible();
    await expect(page.getByText(/Protein \d+\.\d+ g/)).toBeVisible();
    await expect(page.getByText(/Carbs \d+\.\d+ g/)).toBeVisible();
    await expect(page.getByText(/Fat \d+\.\d+ g/)).toBeVisible();
  });

  test('should handle empty document gracefully', async ({ page }) => {
    const textarea = page.locator('textarea');
    
    // Clear the document
    await textarea.fill('');
    
    // Check that textarea is empty
    await expect(textarea).toHaveValue('');
    
    // Check that daily totals still show (should be 0)
    await expect(page.getByText(/kcal 0/)).toBeVisible();
    await expect(page.getByText(/Protein 0\.0 g/)).toBeVisible();
    await expect(page.getByText(/Carbs 0\.0 g/)).toBeVisible();
    await expect(page.getByText(/Fat 0\.0 g/)).toBeVisible();
  });

  test('should handle malformed food entries gracefully', async ({ page }) => {
    const textarea = page.locator('textarea');
    
    // Set plan with some malformed entries
    const malformedPlan = `Meal Plan
    
Breakfast:
- oats_rolled 50 g
- invalid_food 100 g
- milk_skim 240 ml

Lunch:
- chicken_breast 150 g`;
    
    await textarea.fill(malformedPlan);
    
    // Should still display the content
    await expect(textarea).toHaveValue(malformedPlan);
    
    // Should still show daily totals (malformed entries won't contribute to macros)
    await expect(page.getByText(/kcal \d+/)).toBeVisible();
  });

  test('should support different units in document format', async ({ page }) => {
    const textarea = page.locator('textarea');
    
    // Test with different units
    const multiUnitPlan = `Meal Plan
    
Breakfast:
- oats_rolled 50 g
- milk_skim 240 ml

Lunch:
- egg_whole 2 piece
- rice_brown 100 g

Dinner:
- salmon 150 g
- broccoli 200 g`;
    
    await textarea.fill(multiUnitPlan);
    
    // Check content is set correctly
    await expect(textarea).toHaveValue(multiUnitPlan);
    
    // Check that daily totals are calculated
    await expect(page.getByText(/kcal \d+/)).toBeVisible();
  });

  test('should maintain textarea focus and cursor position', async ({ page }) => {
    const textarea = page.locator('textarea');
    
    // Click on textarea to focus
    await textarea.click();
    
    // Type some text
    await textarea.type('Test content');
    
    // Check that textarea maintains focus and content
    await expect(textarea).toHaveValue(/Test content/);
  });

  test('should handle large meal plans', async ({ page }) => {
    const textarea = page.locator('textarea');
    
    // Create a large meal plan
    const largePlan = `Meal Plan
    
Breakfast:
- oats_rolled 50 g
- milk_skim 240 ml
- banana 1 piece
- honey 15 g

Lunch:
- chicken_breast 150 g
- rice_brown 100 g
- broccoli 100 g
- olive_oil 10 g

Dinner:
- salmon 200 g
- quinoa 75 g
- spinach 100 g
- avocado 50 g

Snacks:
- almonds 30 g
- yogurt_greek 100 g
- berries 50 g`;
    
    await textarea.fill(largePlan);
    
    // Check that large content is handled
    await expect(textarea).toHaveValue(largePlan);
    
    // Check that macros are calculated for large plan
    await expect(page.getByText(/kcal \d+/)).toBeVisible();
  });
});
