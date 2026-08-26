import { expect, test, type Page, type Route } from '@playwright/test';

type Counter = {
	id: number;
	name: string;
	value: number;
	createdAt: string;
	updatedAt: string;
};

const timestamp = '2026-08-20T00:00:00.000Z';

const buildCounter = (value: number): Counter => ({
	id: 1,
	name: 'Clicks',
	value,
	createdAt: timestamp,
	updatedAt: timestamp
});

const fulfillJson = async (route: Route, body: unknown, status = 200) => {
	await route.fulfill({
		status,
		contentType: 'application/json',
		body: JSON.stringify(body)
	});
};

async function mockCounterApi(page: Page) {
	let value = 0;

	await page.route('**/api/counters', async (route) => {
		const request = route.request();

		if (request.method() === 'GET') {
			await fulfillJson(route, {
				data: [buildCounter(value)],
				meta: {
					count: 1,
					totalCount: 1,
					totalValue: value,
					generatedAt: timestamp
				}
			});
			return;
		}

		if (request.method() === 'POST') {
			value = Number((request.postDataJSON() as { value?: number } | null)?.value ?? 0);
			await fulfillJson(route, { data: buildCounter(value) }, 201);
			return;
		}

		await route.fallback();
	});

	await page.route('**/api/counters/1', async (route) => {
		const request = route.request();

		if (request.method() === 'GET') {
			await fulfillJson(route, { data: buildCounter(value) });
			return;
		}

		if (request.method() === 'PUT') {
			value = Number((request.postDataJSON() as { value?: number } | null)?.value ?? value);
			await fulfillJson(route, { data: buildCounter(value) });
			return;
		}

		await route.fallback();
	});

	await page.route('**/api/counters/1/increment', async (route) => {
		value += 1;
		await fulfillJson(route, { data: buildCounter(value) });
	});

	await page.route('**/api/counters/1/decrement', async (route) => {
		value -= 1;
		await fulfillJson(route, { data: buildCounter(value) });
	});
}

test('updates the counter from the browser controls', async ({ page }) => {
	await mockCounterApi(page);
	await page.goto('/');

	const value = page.locator('[aria-live="polite"]');

	await expect(page.getByRole('heading', { name: 'Clicks' })).toBeVisible();
	await expect(value).toHaveText('0');

	await page.getByRole('button', { name: 'Add one' }).click();
	await expect(value).toHaveText('1');

	await page.getByRole('button', { name: 'Subtract one' }).click();
	await expect(value).toHaveText('0');

	await page.getByRole('button', { name: 'Add one' }).click();
	await page.getByRole('button', { name: 'Add one' }).click();
	await expect(value).toHaveText('2');

	await page.getByRole('button', { name: 'Reset / リセット' }).click();
	await expect(value).toHaveText('0');
});
