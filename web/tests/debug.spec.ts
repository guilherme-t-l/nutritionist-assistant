import { test, expect } from '@playwright/test';

test.describe('Debug Page Loading', () => {
  test('should capture console errors and debug page loading', async ({ page }) => {
    // Capture console messages
    const consoleMessages: string[] = [];
    page.on('console', msg => {
      consoleMessages.push(`${msg.type()}: ${msg.text()}`);
    });
    
    // Capture page errors
    const pageErrors: string[] = [];
    page.on('pageerror', error => {
      pageErrors.push(error.message);
    });
    
    // Navigate to the page
    await page.goto('/');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Wait for client-side rendering to complete
    await page.waitForTimeout(8000);
    
    // Log all console messages
    console.log('Console messages:', consoleMessages);
    console.log('Page errors:', pageErrors);
    
    // Get the page content to see what's actually there
    const pageContent = await page.content();
    console.log('Page content length:', pageContent.length);
    
    // Check if there are any error messages on the page
    const errorElements = page.locator('text=/error|exception|failed/i');
    const errorCount = await errorElements.count();
    console.log('Error elements found:', errorCount);
    
    if (errorCount > 0) {
      for (let i = 0; i < errorCount; i++) {
        const errorText = await errorElements.nth(i).textContent();
        console.log(`Error ${i + 1}:`, errorText);
      }
    }
    
    // Check the body text to see what's actually rendered
    const bodyText = await page.locator('body').textContent();
    console.log('Body text preview:', bodyText?.substring(0, 500));
    
    // Take a screenshot
    await page.screenshot({ path: 'test-results/debug-page-state.png' });
    
    // For now, just check that the page loaded (even if with errors)
    expect(pageContent.length).toBeGreaterThan(1000);
    
    // Log the actual page title
    const title = await page.title();
    console.log('Page title:', title);
  });
});
