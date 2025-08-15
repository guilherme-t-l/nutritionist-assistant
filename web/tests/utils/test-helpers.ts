import { Page, expect } from '@playwright/test';

export async function waitForPageLoad(page: Page) {
  await page.waitForLoadState('networkidle');
}

export async function clearChat(page: Page) {
  // Clear any existing chat messages by refreshing the page
  await page.reload();
  await waitForPageLoad(page);
}

export async function addMealItem(page: Page, meal: string, food: string, quantity: number, unit: string) {
  const mealSelector = page.getByRole('combobox', { name: 'Meal' });
  const foodSelector = page.getByRole('combobox', { name: 'Food' });
  const quantityInput = page.getByRole('spinbutton', { name: 'Quantity' });
  const unitSelector = page.getByRole('combobox', { name: 'Unit' });
  const addButton = page.getByRole('button', { name: 'Add Item' });
  
  await mealSelector.selectOption(meal);
  await foodSelector.selectOption(food);
  await quantityInput.fill(quantity.toString());
  await unitSelector.selectOption(unit);
  await addButton.click();
}

export async function sendChatMessage(page: Page, message: string) {
  const chatInput = page.getByPlaceholder('Type your message…');
  await chatInput.fill(message);
  await chatInput.press('Enter');
}

export async function setPreferences(page: Page, preferences: {
  allergies?: string;
  dislikes?: string;
  cuisine?: string;
  budget?: string;
}) {
  if (preferences.allergies) {
    const allergiesInput = page.getByPlaceholder('Allergies (comma separated)');
    await allergiesInput.fill(preferences.allergies);
  }
  
  if (preferences.dislikes) {
    const dislikesInput = page.getByPlaceholder('Dislikes');
    await dislikesInput.fill(preferences.dislikes);
  }
  
  if (preferences.cuisine) {
    const cuisineInput = page.getByPlaceholder('Cuisine');
    await cuisineInput.fill(preferences.cuisine);
  }
  
  if (preferences.budget) {
    const budgetSelector = page.getByRole('combobox', { name: 'Budget' });
    await budgetSelector.selectOption(preferences.budget);
  }
}

export async function switchProvider(page: Page, provider: 'webllm' | 'openai') {
  const providerSelector = page.getByRole('combobox', { name: 'Model provider' });
  await providerSelector.selectOption(provider);
}

export async function verifyMealItemExists(page: Page, meal: string, food: string) {
  // Find the meal section by looking for the meal name in a header
  const mealSection = page.locator('div').filter({ hasText: meal }).filter({ hasText: /kcal \d+/ });
  await expect(mealSection.getByText(food)).toBeVisible();
}

export async function verifyMealItemNotExists(page: Page, meal: string, food: string) {
  // Find the meal section by looking for the meal name in a header
  const mealSection = page.locator('div').filter({ hasText: meal }).filter({ hasText: /kcal \d+/ });
  await expect(mealSection.getByText(food)).not.toBeVisible();
}

export async function getDailyTotals(page: Page) {
  const totalsText = await page.getByText(/kcal \d+/).textContent();
  if (!totalsText) return null;
  
  const match = totalsText.match(/kcal (\d+) · Protein ([\d.]+) g · Carbs ([\d.]+) g · Fat ([\d.]+) g/);
  if (!match) return null;
  
  return {
    calories: parseInt(match[1]),
    protein: parseFloat(match[2]),
    carbs: parseFloat(match[3]),
    fat: parseFloat(match[4])
  };
}

export function getMealSection(page: Page, meal: string) {
  // Find the meal section by looking for the meal name in a header with macro info
  return page.locator('div').filter({ hasText: meal }).filter({ hasText: /kcal \d+/ });
}

export function getMealItemRow(page: Page, meal: string, food: string) {
  const mealSection = getMealSection(page, meal);
  return mealSection.locator('div').filter({ hasText: food });
}
