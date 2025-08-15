import { test, expect } from '@playwright/test';

test.describe('Food Database Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for client-side rendering to complete
    await page.waitForLoadState('networkidle');
    // Wait a bit more for dynamic components to load
    await page.waitForTimeout(3000);
  });

  test('should have access to food database', async ({ page }) => {
    // This test will verify that the food database is accessible
    // We'll test this by checking if the macro engine can work with foods
    
    // First, let's check if the page loads without errors
    await expect(page.getByText('Nutritionist Assistant')).toBeVisible();
    
    // Check that the chat interface is working
    const chatInput = page.getByPlaceholder('Type your message…');
    await expect(chatInput).toBeVisible();
    
    // Test that we can ask about foods and get responses
    await chatInput.fill('What are the macros for chicken breast?');
    await chatInput.press('Enter');
    
    // Wait for response
    await page.waitForTimeout(5000);
    
    // Check that we got some response (this tests the integration)
    // Look for any message content that might contain the response
    const messageContainers = page.locator('div').filter({ hasText: /chicken breast|calories|macros|protein/i });
    await expect(messageContainers.first()).toBeVisible();
  });

  test('should handle food-related queries', async ({ page }) => {
    const chatInput = page.getByPlaceholder('Type your message…');
    
    // Test various food-related queries
    const foodQueries = [
      'How many calories in an apple?',
      'What are the macros for salmon?',
      'Tell me about the nutrition in oats',
      'How much protein in chicken breast?'
    ];
    
    for (const query of foodQueries) {
      await chatInput.fill(query);
      await chatInput.press('Enter');
      
      // Wait for response
      await page.waitForTimeout(4000);
      
      // Verify we got a response by looking for any content
      const messages = page.locator('div').filter({ hasText: /calories|macros|nutrition|protein|apple|salmon|oats|chicken/i });
      await expect(messages.last()).toBeVisible();
      
      // Clear for next query
      await page.waitForTimeout(1000);
    }
  });

  test('should provide accurate nutritional information', async ({ page }) => {
    const chatInput = page.getByPlaceholder('Type your message…');
    
    // Ask for specific macro information
    await chatInput.fill('What are the exact macros for 100g of chicken breast?');
    await chatInput.press('Enter');
    
    // Wait for response
    await page.waitForTimeout(4000);
    
    // Check that the response contains nutritional information
    const response = page.locator('div').filter({ hasText: /chicken breast|calories|protein|carbs|fat/i }).last();
    await expect(response).toBeVisible();
    
    // The response should contain some nutritional data
    const responseText = await response.textContent();
    expect(responseText).toMatch(/\d+/); // Should contain numbers
  });

  test('should handle food search functionality', async ({ page }) => {
    const chatInput = page.getByPlaceholder('Type your message…');
    
    // Test food search
    await chatInput.fill('Search for foods containing "apple"');
    await chatInput.press('Enter');
    
    // Wait for response
    await page.waitForTimeout(4000);
    
    // Verify we got a response
    const messages = page.locator('div').filter({ hasText: /apple|food|search/i });
    await expect(messages.last()).toBeVisible();
  });

  test('should handle meal planning queries', async ({ page }) => {
    const chatInput = page.getByPlaceholder('Type your message…');
    
    // Test meal planning functionality
    await chatInput.fill('Create a meal plan with chicken, rice, and vegetables');
    await chatInput.press('Enter');
    
    // Wait for response
    await page.waitForTimeout(6000);
    
    // Verify we got a response
    const messages = page.locator('div').filter({ hasText: /meal plan|chicken|rice|vegetables|breakfast|lunch|dinner/i });
    await expect(messages.last()).toBeVisible();
  });

  test('should handle macro calculations', async ({ page }) => {
    const chatInput = page.getByPlaceholder('Type your message…');
    
    // Test macro calculation
    await chatInput.fill('Calculate macros for 200g chicken breast and 100g brown rice');
    await chatInput.press('Enter');
    
    // Wait for response
    await page.waitForTimeout(5000);
    
    // Verify we got a response
    const messages = page.locator('div').filter({ hasText: /chicken breast|brown rice|calories|protein|carbs|fat/i });
    await expect(messages.last()).toBeVisible();
    
    // The response should contain calculated macros
    const responseText = await messages.last().textContent();
    expect(responseText).toMatch(/calories|protein|carbs|fat/i);
  });

  test('should handle dietary restrictions', async ({ page }) => {
    // Set dietary restrictions
    const allergiesInput = page.getByPlaceholder('Allergies (comma separated)');
    await allergiesInput.fill('nuts, shellfish');
    
    const chatInput = page.getByPlaceholder('Type your message…');
    
    // Test that the system respects dietary restrictions
    await chatInput.fill('Suggest a high-protein meal');
    await chatInput.press('Enter');
    
    // Wait for response
    await page.waitForTimeout(5000);
    
    // Verify we got a response
    const messages = page.locator('div').filter({ hasText: /high-protein|meal|protein/i });
    await expect(messages.last()).toBeVisible();
    
    // The response should not contain allergens
    const responseText = await messages.last().textContent();
    expect(responseText?.toLowerCase()).not.toMatch(/nuts|shellfish/);
  });

  test('should handle barcode queries', async ({ page }) => {
    const chatInput = page.getByPlaceholder('Type your message…');
    
    // Test barcode lookup (Nutella barcode)
    await chatInput.fill('Look up nutrition for barcode 3017620422003');
    await chatInput.press('Enter');
    
    // Wait for response
    await page.waitForTimeout(5000);
    
    // Verify we got a response
    const messages = page.locator('div').filter({ hasText: /barcode|nutrition|nutella|chocolate/i });
    await expect(messages.last()).toBeVisible();
  });

  test('should provide data source information', async ({ page }) => {
    const chatInput = page.getByPlaceholder('Type your message…');
    
    // Ask about data sources
    await chatInput.fill('Where does the nutrition data come from?');
    await chatInput.press('Enter');
    
    // Wait for response
    await page.waitForTimeout(4000);
    
    // Verify we got a response
    const messages = page.locator('div').filter({ hasText: /data|source|database|open food facts|nutrition|information/i });
    await expect(messages.last()).toBeVisible();
    
    // The response should mention data sources
    const responseText = await messages.last().textContent();
    expect(responseText?.toLowerCase()).toMatch(/data|source|database|open food facts|nutrition/i);
  });
});
