import { test, expect } from '@playwright/test';

test.describe('NOSYOR.M.I Critical Path', () => {

  test('TC-E2E-01: Dashboard loads with statement data', async ({ page }) => {
    await page.goto('/');
    
    // Dashboard heading visible
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    
    // Stat cards visible
    await expect(page.getByText('TOTAL INCOME')).toBeVisible();
    await expect(page.getByText('TOTAL EXPENSES')).toBeVisible();
    await expect(page.getByText('Net', { exact: true })).toBeVisible();
    await expect(page.getByText('Anomalies', { exact: true })).toBeVisible();
  });

  test('TC-E2E-02: Sidebar navigation works for all pages', async ({ page }) => {
    await page.goto('/');

    // Navigate to Transactions
    await page.getByRole('link', { name: 'Transactions' }).click();
    await expect(page).toHaveURL(/.*transactions/);
    await expect(page.getByRole('heading', { name: 'Transactions' })).toBeVisible();

    // Navigate to Statements
    await page.getByRole('link', { name: 'Statements' }).click();
    await expect(page).toHaveURL(/.*statements/);
    await expect(page.getByRole('heading', { name: 'Statements' })).toBeVisible();

    // Navigate to Chat
    await page.getByRole('link', { name: 'NOSYOR.M.I Chat' }).click();
    await expect(page).toHaveURL(/.*chat/);
    await expect(page.getByRole('heading', { name: 'Ask NOSYOR.M.I' })).toBeVisible();

    // Navigate back to Dashboard
    await page.getByRole('link', { name: 'Dashboard' }).click();
    await expect(page).toHaveURL('http://localhost:5173/');
  });

  test('TC-E2E-03: Transactions page shows transaction list', async ({ page }) => {
    await page.goto('/transactions');

    // Wait for transactions to load
    await expect(page.getByText('32 transactions')).toBeVisible({ timeout: 10000 });

    // Search box visible
    await expect(page.getByPlaceholder('Search transactions...')).toBeVisible();

    // Summary panel visible
    await expect(page.getByText('Summary')).toBeVisible();
  });

  test('TC-E2E-04: Statements page shows upload button and statement list', async ({ page }) => {
    await page.goto('/statements');

    // Upload button visible
    await expect(page.getByRole('button', { name: '+ Upload Statement' })).toBeVisible();

    // At least one statement card visible
    await expect(page.getByText('sample_statement.csv')).toBeVisible({ timeout: 5000 });
  });

  test('TC-E2E-05: Chat page loads with spending overview', async ({ page }) => {
    await page.goto('/chat');

    // Chat heading visible
    await expect(page.getByRole('heading', { name: 'Ask NOSYOR.M.I' })).toBeVisible();

    // Spending overview panel visible
    await expect(page.getByText('Spending Overview')).toBeVisible();

    // Input box visible and enabled
    await expect(page.getByPlaceholder('Ask about your spending...')).toBeVisible();
    await expect(page.getByPlaceholder('Ask about your spending...')).toBeEnabled();
  });

  test('TC-E2E-06: Upload modal opens and closes', async ({ page }) => {
    await page.goto('/statements');

    // Open upload modal
    await page.getByRole('button', { name: '+ Upload Statement' }).click();
    await expect(page.getByText('Drop your CSV here')).toBeVisible();

    // Close modal with X button
    await page.getByLabel('Close').click();
    await expect(page.getByText('Drop your CSV here')).not.toBeVisible();
  });

});
