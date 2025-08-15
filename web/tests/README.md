# Playwright E2E Testing

This directory contains end-to-end tests for the Nutritionist Assistant application using Playwright.

## Test Structure

- **`home.spec.ts`** - Tests for the main home page and chat functionality
- **`plan-panel.spec.ts`** - Tests for the meal planning panel component
- **`plan-doc-editor.spec.ts`** - Tests for the plan document editor
- **`api-chat.spec.ts`** - Tests for the chat API endpoint
- **`integration.spec.ts`** - Comprehensive integration tests covering full workflows
- **`utils/test-helpers.ts`** - Reusable test utility functions

## Running Tests

### Prerequisites

Make sure you have the development server running:
```bash
npm run dev
```

### Run All Tests
```bash
npm run test:e2e
```

### Run Tests with UI
```bash
npm run test:e2e:ui
```

### Run Tests in Headed Mode
```bash
npm run test:e2e:headed
```

### Run Tests in Debug Mode
```bash
npm run test:e2e:debug
```

### Run Specific Test File
```bash
npx playwright test home.spec.ts
```

### Run Tests for Specific Browser
```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

## Test Configuration

The Playwright configuration is in `playwright.config.ts` and includes:

- **Multiple browsers**: Chrome, Firefox, Safari
- **Web server**: Automatically starts the Next.js dev server
- **Screenshots**: Captured on test failures
- **Traces**: Captured on first retry for debugging
- **Parallel execution**: Tests run in parallel for faster execution

## Test Utilities

The `test-helpers.ts` file provides common functions:

- `addMealItem()` - Add items to meal plans
- `sendChatMessage()` - Send chat messages
- `setPreferences()` - Set user preferences
- `switchProvider()` - Switch between LLM providers
- `verifyMealItemExists()` - Verify meal items exist
- `getDailyTotals()` - Get calculated daily macro totals

## Writing Tests

### Basic Test Structure
```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should do something', async ({ page }) => {
    // Test implementation
    await expect(page.getByText('Expected Text')).toBeVisible();
  });
});
```

### Best Practices

1. **Use descriptive test names** that explain what is being tested
2. **Use `beforeEach`** to set up common test state
3. **Use accessibility selectors** like `getByRole()` and `getByLabel()`
4. **Test user workflows** rather than implementation details
5. **Use test utilities** for common operations
6. **Handle async operations** properly with `await`

### Example Test
```typescript
test('should add meal item to breakfast', async ({ page }) => {
  // Arrange
  const mealSelector = page.getByRole('combobox', { name: 'Meal' });
  const foodSelector = page.getByRole('combobox', { name: 'Food' });
  
  // Act
  await mealSelector.selectOption('Breakfast');
  await foodSelector.selectOption('oats_rolled');
  
  // Assert
  await expect(page.getByText('oats_rolled')).toBeVisible();
});
```

## Debugging Tests

### View Test Results
```bash
npx playwright show-report
```

### Debug Individual Test
```bash
npx playwright test --debug home.spec.ts
```

### Run Tests in Headed Mode
```bash
npx playwright test --headed
```

### Take Screenshots
Tests automatically capture screenshots on failure. You can also add manual screenshots:

```typescript
await page.screenshot({ path: 'debug-screenshot.png' });
```

## Continuous Integration

The Playwright configuration includes CI-specific settings:

- **Retries**: 2 retries in CI environment
- **Workers**: Single worker in CI for stability
- **Forbid only**: Prevents `test.only()` in CI
- **Web server**: Proper timeout handling for CI environments

## Browser Support

Tests run against:
- **Chromium** (Chrome/Edge)
- **Firefox**
- **WebKit** (Safari)

This ensures cross-browser compatibility for your application.
