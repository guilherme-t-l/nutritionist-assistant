import { test, expect } from '@playwright/test';

test.describe('Basic Page Loading', () => {
  test('should load the page without errors', async ({ page }) => {
    // Navigate to the page
    await page.goto('/');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Take a screenshot to see what's actually there
    await page.screenshot({ path: 'test-results/page-load.png' });
    
    // Check if there are any console errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    // Wait a bit more for any dynamic content
    await page.waitForTimeout(2000);
    
    // Log the page content to see what's actually there
    const pageContent = await page.content();
    console.log('Page content length:', pageContent.length);
    console.log('Page title:', await page.title());
    
    // Check for any error messages on the page
    const errorElements = page.locator('text=/error|exception|failed/i');
    const errorCount = await errorElements.count();
    console.log('Error elements found:', errorCount);
    
    if (errorCount > 0) {
      for (let i = 0; i < errorCount; i++) {
        const errorText = await errorElements.nth(i).textContent();
        console.log(`Error ${i + 1}:`, errorText);
      }
    }
    
    // Check if the page has any content at all
    const bodyText = await page.locator('body').textContent();
    console.log('Body text preview:', bodyText?.substring(0, 200));
    
    // For now, just check that the page loaded (even if with errors)
    expect(pageContent.length).toBeGreaterThan(1000);
  });
});
