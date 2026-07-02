import { test, expect } from '@playwright/test';

const TEST_EMAIL = `e2e-${Date.now()}@test.com`;
const TEST_PASSWORD = 'StrongPass123!';

test.describe('Authentication Flow', () => {
  test('should complete full registration and login cycle', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');
    await expect(page).toHaveTitle(/DZCASH/);

    // Click Register
    await page.click('text=Register');
    await expect(page).toHaveURL(/\/register/);

    // Fill registration form
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[placeholder*="password"]', TEST_PASSWORD);
    await page.fill('input[placeholder*="confirm"]', TEST_PASSWORD);

    // Submit
    await page.click('button[type="submit"]');

    // Should redirect to dashboard or show success
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

    // Logout
    await page.click('text=Sign Out');
    await expect(page).toHaveURL(/\/login/);
  });

  test('should reject invalid login', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[type="email"]', 'wrong@test.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    // Should show error message
    await expect(page.locator('text=Invalid')).toBeVisible({ timeout: 5000 });
  });

  test('should login with existing credentials', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

    // Dashboard should show user info
    await expect(page.locator('text=Dashboard')).toBeVisible();
  });
});

test.describe('Offer Browsing', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  });

  test('should browse offers page', async ({ page }) => {
    await page.click('text=Offers');
    await expect(page).toHaveURL(/\/offers/);

    // Offers page should load
    await expect(page.locator('text=Available')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Wallet', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  });

  test('should display wallet page with balance', async ({ page }) => {
    await page.click('text=Wallet');
    await expect(page).toHaveURL(/\/wallet/);

    // Should show balance cards
    await expect(page.locator('text=Available Balance')).toBeVisible({ timeout: 10000 });
  });

  test('should show withdrawal form', async ({ page }) => {
    await page.click('text=Wallet');
    await expect(page).toHaveURL(/\/wallet/);

    // Withdrawal form should be visible
    await expect(page.locator('text=Request Cashout')).toBeVisible({ timeout: 10000 });
  });
});
