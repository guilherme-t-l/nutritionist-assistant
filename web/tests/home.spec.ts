import { test, expect } from '@playwright/test';

test.describe('Nutritionist Assistant Home Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display the main page elements', async ({ page }) => {
    // Check header
    await expect(page.getByRole('banner').getByText('Nutritionist Assistant')).toBeVisible();
    
    // Check provider selector
    await expect(page.getByRole('combobox', { name: 'Model provider' })).toBeVisible();
    await expect(page.getByText('Local (WebLLM)')).toBeVisible();
    await expect(page.getByText('OpenAI (server)')).toBeVisible();
    
    // Check model selector (should be visible for webllm)
    await expect(page.getByRole('combobox', { name: 'Local model' })).toBeVisible();
    
    // Check chat input
    await expect(page.getByPlaceholder('Type your message…')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send' })).toBeVisible();
    
    // Check preferences inputs
    await expect(page.getByPlaceholder('Allergies (comma separated)')).toBeVisible();
    await expect(page.getByPlaceholder('Dislikes')).toBeVisible();
    await expect(page.getByPlaceholder('Cuisine')).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Budget' })).toBeVisible();
    
    // Check footer
    await expect(page.getByText('Educational nutrition guidance only, not medical advice.')).toBeVisible();
  });

  test('should allow switching between providers', async ({ page }) => {
    const providerSelector = page.getByRole('combobox', { name: 'Model provider' });
    
    // Initially should be webllm
    await expect(providerSelector).toHaveValue('webllm');
    await expect(page.getByRole('combobox', { name: 'Local model' })).toBeVisible();
    
    // Switch to OpenAI
    await providerSelector.selectOption('openai');
    await expect(providerSelector).toHaveValue('openai');
    await expect(page.getByRole('combobox', { name: 'Local model' })).not.toBeVisible();
    
    // Switch back to webllm
    await providerSelector.selectOption('webllm');
    await expect(providerSelector).toHaveValue('webllm');
    await expect(page.getByRole('combobox', { name: 'Local model' })).toBeVisible();
  });

  test('should allow changing local models', async ({ page }) => {
    const modelSelector = page.getByRole('combobox', { name: 'Local model' });
    
    // Check available options
    await expect(modelSelector).toHaveValue('Llama-3.2-1B-Instruct-q4f32_1-MLC');
    
    // Change to Phi-3
    await modelSelector.selectOption('Phi-3-mini-4k-instruct-q4f16_1-MLC');
    await expect(modelSelector).toHaveValue('Phi-3-mini-4k-instruct-q4f16_1-MLC');
    
    // Change to Qwen2
    await modelSelector.selectOption('Qwen2-1.5B-Instruct-q4f16_1-MLC');
    await expect(modelSelector).toHaveValue('Qwen2-1.5B-Instruct-q4f16_1-MLC');
  });

  test('should handle chat input and send button', async ({ page }) => {
    const chatInput = page.getByPlaceholder('Type your message…');
    const sendButton = page.getByRole('button', { name: 'Send' });
    
    // Type a message
    await chatInput.fill('Hello, I need help with my nutrition plan');
    await expect(chatInput).toHaveValue('Hello, I need help with my nutrition plan');
    
    // Send the message
    await sendButton.click();
    
    // Check that the message appears in chat
    await expect(page.getByText('Hello, I need help with my nutrition plan')).toBeVisible();
    
    // Check that input is cleared
    await expect(chatInput).toHaveValue('');
  });

  test('should handle Enter key to send messages', async ({ page }) => {
    const chatInput = page.getByPlaceholder('Type your message…');
    
    // Type a message and press Enter
    await chatInput.fill('Test message with Enter key');
    await chatInput.press('Enter');
    
    // Check that the message appears
    await expect(page.getByText('Test message with Enter key')).toBeVisible();
    
    // Check that input is cleared
    await expect(chatInput).toHaveValue('');
  });

  test('should handle preferences input', async ({ page }) => {
    const allergiesInput = page.getByPlaceholder('Allergies (comma separated)');
    const dislikesInput = page.getByPlaceholder('Dislikes');
    const cuisineInput = page.getByPlaceholder('Cuisine');
    const budgetSelector = page.getByRole('combobox', { name: 'Budget' });
    
    // Fill preferences
    await allergiesInput.fill('nuts, shellfish');
    await dislikesInput.fill('mushrooms, olives');
    await cuisineInput.fill('Mediterranean');
    await budgetSelector.selectOption('medium');
    
    // Verify values
    await expect(allergiesInput).toHaveValue('nuts, shellfish');
    await expect(dislikesInput).toHaveValue('mushrooms, olives');
    await expect(cuisineInput).toHaveValue('Mediterranean');
    await expect(budgetSelector).toHaveValue('medium');
  });

  test('should handle slash commands for adding items', async ({ page }) => {
    const chatInput = page.getByPlaceholder('Type your message…');
    
    // Test slash command to add item
    await chatInput.fill('/add oats_rolled 50g to breakfast');
    await chatInput.press('Enter');
    
    // Check that the command is processed and response appears
    await expect(page.getByText('Added to Breakfast.')).toBeVisible();
  });

  test('should display chat messages with proper styling', async ({ page }) => {
    const chatInput = page.getByPlaceholder('Type your message…');
    
    // Send a user message
    await chatInput.fill('User test message');
    await chatInput.press('Enter');
    
    // Check user message styling
    const userMessage = page.getByText('User test message');
    await expect(userMessage).toBeVisible();
    
    // Check that user avatar shows 'U'
    await expect(page.locator('text=U').first()).toBeVisible();
    
    // Check message container styling
    const messageContainer = userMessage.locator('..').locator('..');
    await expect(messageContainer).toHaveClass(/bg-slate-900\/70/);
  });

  test('should handle empty input gracefully', async ({ page }) => {
    const chatInput = page.getByPlaceholder('Type your message…');
    const sendButton = page.getByRole('button', { name: 'Send' });
    
    // Try to send empty message
    await sendButton.click();
    
    // Should not add any messages
    const messages = page.locator('[class*="bg-slate-900/70"]');
    await expect(messages).toHaveCount(0);
  });

  test('should display status updates', async ({ page }) => {
    const chatInput = page.getByPlaceholder('Type your message…');
    
    // Initially should show "Ready"
    await expect(page.getByText('Ready')).toBeVisible();
    
    // Send a message to trigger status change
    await chatInput.fill('Test status message');
    await chatInput.press('Enter');
    
    // Status should change (though exact timing depends on response)
    // We'll just check that the status element exists
    await expect(page.locator('[aria-live="polite"]')).toBeVisible();
  });
});
