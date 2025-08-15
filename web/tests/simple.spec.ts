import { test, expect } from '@playwright/test';

test.describe('Simple Page Loading', () => {
  test('should load the page without client-side errors', async ({ page }) => {
    // Navigate to the page
    await page.goto('/');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Wait for client-side rendering to complete
    await page.waitForTimeout(5000);
    
    // Check if the main header is visible
    await expect(page.getByText('Nutritionist Assistant')).toBeVisible();
    
    // Check if the chat input is visible
    await expect(page.getByPlaceholder('Type your message…')).toBeVisible();
    
    // Check if the send button is visible
    await expect(page.getByRole('button', { name: 'Send' })).toBeVisible();
    
    // Check if preferences inputs are visible
    await expect(page.getByPlaceholder('Allergies (comma separated)')).toBeVisible();
    await expect(page.getByPlaceholder('Dislikes')).toBeVisible();
    await expect(page.getByPlaceholder('Cuisine')).toBeVisible();
    
    // Take a screenshot to verify the page loaded correctly
    await page.screenshot({ path: 'test-results/page-loaded-successfully.png' });
    
    console.log('✅ Page loaded successfully without client-side errors!');
  });
});
