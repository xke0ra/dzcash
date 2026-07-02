import { test, expect } from '@playwright/test';

test.describe('Admin Panel', () => {
  let adminEmail: string;
  let adminPassword: string;

  test.beforeAll(async ({ browser }) => {
    adminEmail = `admin-${Date.now()}@dzcash.com`;
    adminPassword = 'AdminPass123!';

    // Create admin user via API
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('/api/auth/register');
    // Note: In production, you'd seed an admin user
    // For E2E we'll test the admin page access restrictions
    await context.close();
  });

  test('should redirect non-admin users from admin page', async ({ page }) => {
    // Register a regular user
    const userEmail = `user-${Date.now()}@test.com`;
    await page.goto('/register');
    await page.fill('input[type="email"]', userEmail);
    await page.fill('input[placeholder*="password"]', 'UserPass123!');
    await page.fill('input[placeholder*="confirm"]', 'UserPass123!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

    // Try accessing admin
    await page.goto('/admin');
    await expect(page.locator('text=Access Denied')).toBeVisible({ timeout: 10000 });
  });

  test('should show admin panel for admin users', async ({ page }) => {
    // Login as admin (need to be seeded in DB)
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@dzcash.com');
    await page.fill('input[type="password"]', 'Admin@123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

    // Access admin panel
    await page.click('text=Admin Panel');
    await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });

    // Should see admin dashboard
    await expect(page.locator('text=Dashboard')).toBeVisible({ timeout: 10000 });
  });

  test('should navigate admin sidebar pages', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@dzcash.com');
    await page.fill('input[type="password"]', 'Admin@123');
    await page.click('button[type="submit"]');

    // Navigate to admin
    await page.goto('/admin');

    // Click each nav item
    const navItems = ['Users', 'Withdrawals', 'Offers', 'Fraud Review'];
    for (const item of navItems) {
      await page.click(`text=${item}`);
      await expect(page).toHaveURL(new RegExp(item.toLowerCase().replace(' ', '-')), { timeout: 10000 });
    }
  });
});
