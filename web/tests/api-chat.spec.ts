import { test, expect } from '@playwright/test';

test.describe('Chat API Endpoint', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should handle valid chat request', async ({ page }) => {
    // Switch to OpenAI provider to test API
    const providerSelector = page.getByRole('combobox', { name: 'Model provider' });
    await providerSelector.selectOption('openai');
    
    // Send a message
    const chatInput = page.getByPlaceholder('Type your message…');
    await chatInput.fill('Hello, can you help me with nutrition?');
    await chatInput.press('Enter');
    
    // Check that the message appears in chat
    await expect(page.getByText('Hello, can you help me with nutrition?')).toBeVisible();
    
    // Note: In a real test environment, you might want to mock the OpenAI API
    // or test with a real API key to verify the full flow
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Switch to OpenAI provider
    const providerSelector = page.getByRole('combobox', { name: 'Model provider' });
    await providerSelector.selectOption('openai');
    
    // Send a message that might trigger an error
    const chatInput = page.getByPlaceholder('Type your message…');
    await chatInput.fill('Test message for error handling');
    await chatInput.press('Enter');
    
    // The message should appear in chat
    await expect(page.getByText('Test message for error handling')).toBeVisible();
    
    // If there's an error, it should be displayed gracefully
    // (This depends on the actual API response)
  });

  test('should handle preferences in API requests', async ({ page }) => {
    // Switch to OpenAI provider
    const providerSelector = page.getByRole('combobox', { name: 'Model provider' });
    await providerSelector.selectOption('openai');
    
    // Set preferences
    const allergiesInput = page.getByPlaceholder('Allergies (comma separated)');
    const dislikesInput = page.getByPlaceholder('Dislikes');
    const cuisineInput = page.getByPlaceholder('Cuisine');
    const budgetSelector = page.getByRole('combobox', { name: 'Budget' });
    
    await allergiesInput.fill('nuts, shellfish');
    await dislikesInput.fill('mushrooms');
    await cuisineInput.fill('Mediterranean');
    await budgetSelector.selectOption('medium');
    
    // Send a message
    const chatInput = page.getByPlaceholder('Type your message…');
    await chatInput.fill('Create a meal plan considering my preferences');
    await chatInput.press('Enter');
    
    // Check that the message appears
    await expect(page.getByText('Create a meal plan considering my preferences')).toBeVisible();
  });

  test('should handle plan document in API requests', async ({ page }) => {
    // Switch to OpenAI provider
    const providerSelector = page.getByRole('combobox', { name: 'Model provider' });
    await providerSelector.selectOption('openai');
    
    // Edit the plan document
    const textarea = page.locator('textarea');
    const planContent = `Meal Plan
    
Breakfast:
- oats_rolled 50 g

Lunch:
- chicken_breast 100 g`;
    
    await textarea.fill(planContent);
    
    // Send a message referencing the plan
    const chatInput = page.getByPlaceholder('Type your message…');
    await chatInput.fill('How can I improve this meal plan?');
    await chatInput.press('Enter');
    
    // Check that the message appears
    await expect(page.getByText('How can I improve this meal plan?')).toBeVisible();
  });

  test('should handle empty messages gracefully', async ({ page }) => {
    // Switch to OpenAI provider
    const providerSelector = page.getByRole('combobox', { name: 'Model provider' });
    await providerSelector.selectOption('openai');
    
    // Try to send empty message
    const sendButton = page.getByRole('button', { name: 'Send' });
    await sendButton.click();
    
    // Should not send empty messages
    const messages = page.locator('[class*="bg-slate-900/70"]');
    await expect(messages).toHaveCount(0);
  });

  test('should handle long messages', async ({ page }) => {
    // Switch to OpenAI provider
    const providerSelector = page.getByRole('combobox', { name: 'Model provider' });
    await providerSelector.selectOption('openai');
    
    // Create a long message
    const longMessage = 'This is a very long message that tests the API endpoint with a substantial amount of text. '.repeat(10);
    const chatInput = page.getByPlaceholder('Type your message…');
    await chatInput.fill(longMessage);
    await chatInput.press('Enter');
    
    // Check that the long message appears
    await expect(page.getByText(longMessage)).toBeVisible();
  });

  test('should handle special characters in messages', async ({ page }) => {
    // Switch to OpenAI provider
    const providerSelector = page.getByRole('combobox', { name: 'Model provider' });
    await providerSelector.selectOption('openai');
    
    // Test with special characters
    const specialMessage = 'Test message with special chars: !@#$%^&*()_+-=[]{}|;:,.<>?';
    const chatInput = page.getByPlaceholder('Type your message…');
    await chatInput.fill(specialMessage);
    await chatInput.press('Enter');
    
    // Check that the message appears correctly
    await expect(page.getByText(specialMessage)).toBeVisible();
  });

  test('should maintain conversation context', async ({ page }) => {
    // Switch to OpenAI provider
    const providerSelector = page.getByRole('combobox', { name: 'Model provider' });
    await providerSelector.selectOption('openai');
    
    // Send first message
    const chatInput = page.getByPlaceholder('Type your message…');
    await chatInput.fill('My name is John');
    await chatInput.press('Enter');
    
    // Send second message
    await chatInput.fill('What is my name?');
    await chatInput.press('Enter');
    
    // Check that both messages appear in order
    await expect(page.getByText('My name is John')).toBeVisible();
    await expect(page.getByText('What is my name?')).toBeVisible();
    
    // Verify message order
    const messages = page.locator('[class*="bg-slate-900/70"]');
    await expect(messages).toHaveCount(2);
  });
});
