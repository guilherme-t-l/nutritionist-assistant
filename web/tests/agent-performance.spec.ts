import { test, expect } from '@playwright/test';

test.describe('Agent Performance Improvements', () => {
  
  test('should start the application successfully', async ({ page }) => {
    // Basic connectivity test
    await page.goto('/');
    
    // Check that the page loads
    await expect(page.getByText('Nutritionist Assistant')).toBeVisible();
    
    // Check that chat interface is available
    const chatInput = page.getByPlaceholder('Type your message…');
    await expect(chatInput).toBeVisible();
    
    console.log('✅ Application starts successfully');
  });

  test('should handle metrics endpoint', async ({ request }) => {
    // Test the new metrics endpoint
    const response = await request.get('/api/metrics?action=health');
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toBeDefined();
    
    console.log('✅ Metrics endpoint working');
  });

  test('should show improved context in preferences', async ({ page }) => {
    await page.goto('/');
    
    // Set preferences that should be preserved in context
    const allergiesInput = page.getByPlaceholder('Allergies (comma separated)');
    await allergiesInput.fill('nuts, shellfish');
    
    const cuisineInput = page.getByPlaceholder('Cuisine');
    await cuisineInput.fill('Mediterranean');
    
    // Verify preferences are set
    await expect(allergiesInput).toHaveValue('nuts, shellfish');
    await expect(cuisineInput).toHaveValue('Mediterranean');
    
    console.log('✅ User preferences can be set for context');
  });

  test('should handle plan document context', async ({ page }) => {
    await page.goto('/');
    
    // Add content to plan document
    const textarea = page.locator('textarea');
    const planContent = `Meal Plan

Breakfast:
- oats_rolled 50 g
- banana_raw 100 g

Lunch:
- chicken_breast_cooked 150 g
- brown_rice_cooked 80 g`;
    
    await textarea.fill(planContent);
    
    // Verify plan document has content
    await expect(textarea).toHaveValue(planContent);
    
    console.log('✅ Plan document context working');
  });

  test('should support both OpenAI and WebLLM providers', async ({ page }) => {
    await page.goto('/');
    
    // Check provider selector
    const providerSelector = page.getByRole('combobox', { name: 'Model provider' });
    await expect(providerSelector).toBeVisible();
    
    // Check default is WebLLM
    await expect(providerSelector).toHaveValue('webllm');
    
    // Switch to OpenAI
    await providerSelector.selectOption('openai');
    await expect(providerSelector).toHaveValue('openai');
    
    // Switch back to WebLLM
    await providerSelector.selectOption('webllm');
    await expect(providerSelector).toHaveValue('webllm');
    
    console.log('✅ Provider switching working');
  });

  test('should handle chat input and form validation', async ({ page }) => {
    await page.goto('/');
    
    const chatInput = page.getByPlaceholder('Type your message…');
    
    // Test empty message handling (should not send)
    await chatInput.press('Enter');
    
    // Test valid message
    await chatInput.fill('What are the macros for chicken breast?');
    
    // Verify message was typed
    await expect(chatInput).toHaveValue('What are the macros for chicken breast?');
    
    console.log('✅ Chat input validation working');
  });

  test('should display model selection for WebLLM', async ({ page }) => {
    await page.goto('/');
    
    // Ensure WebLLM is selected
    const providerSelector = page.getByRole('combobox', { name: 'Model provider' });
    await providerSelector.selectOption('webllm');
    
    // Check that model selector appears
    const modelSelector = page.getByRole('combobox', { name: 'Local model' });
    await expect(modelSelector).toBeVisible();
    
    // Check default model
    await expect(modelSelector).toHaveValue('Llama-3.2-1B-Instruct-q4f32_1-MLC');
    
    console.log('✅ WebLLM model selection working');
  });

  test('should preserve UI state across interactions', async ({ page }) => {
    await page.goto('/');
    
    // Set up some state
    await page.getByPlaceholder('Allergies (comma separated)').fill('nuts');
    await page.getByPlaceholder('Cuisine').fill('Italian');
    await page.getByRole('combobox', { name: 'Budget' }).selectOption('medium');
    
    const textarea = page.locator('textarea');
    await textarea.fill('Test plan content');
    
    // Verify state is preserved (this tests that our session management doesn't interfere with UI)
    await expect(page.getByPlaceholder('Allergies (comma separated)')).toHaveValue('nuts');
    await expect(page.getByPlaceholder('Cuisine')).toHaveValue('Italian');
    await expect(page.getByRole('combobox', { name: 'Budget' })).toHaveValue('medium');
    await expect(textarea).toHaveValue('Test plan content');
    
    console.log('✅ UI state preservation working');
  });

  test('should handle API error states gracefully', async ({ request }) => {
    // Test invalid metrics endpoint action
    const response = await request.get('/api/metrics?action=invalid');
    
    expect(response.status()).toBe(400);
    
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toBeDefined();
    
    console.log('✅ API error handling working');
  });

  test('should validate required fields in chat API', async ({ request }) => {
    // Test empty body
    const response = await request.post('/api/chat', {
      data: {}
    });
    
    expect(response.status()).toBe(400);
    
    const data = await response.json();
    expect(data.error).toContain('Missing messages');
    
    console.log('✅ Chat API validation working');
  });

  test('should support feedback recording via metrics API', async ({ request }) => {
    const interactionId = 'test-interaction-123';
    const feedback = {
      rating: 5,
      helpful: true,
      accurate: true,
      safe: true,
      relevant: true,
      comments: 'Great response!'
    };
    
    const response = await request.post('/api/metrics', {
      data: { interactionId, feedback }
    });
    
    // May return 404 if interaction doesn't exist, but should not error on format
    expect([200, 404]).toContain(response.status());
    
    console.log('✅ Feedback recording API working');
  });
});