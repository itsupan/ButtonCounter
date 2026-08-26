import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: 'tests/e2e',
	use: { baseURL: 'http://127.0.0.1:4173' },
	webServer: {
		command: 'pnpm run build && pnpm run preview --host 127.0.0.1',
		port: 4173,
		reuseExistingServer: !process.env.CI
	},
	testMatch: '**/*.e2e.{ts,js}'
});
