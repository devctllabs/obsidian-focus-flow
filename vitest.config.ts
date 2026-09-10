import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      {
        resolve: {
          alias: {
            obsidian: path.resolve(dirname, 'src/test/obsidian.ts'),
          },
        },
        test: {
          name: 'unit',
          environment: 'jsdom',
          include: ['src/**/*.test.{ts,tsx}'],
          setupFiles: ['./src/test/setup.ts'],
        },
      },
      {
        extends: true,
        optimizeDeps: { include: ['fractional-indexing', 'yaml'] },
        plugins: [
          storybookTest({
            configDir: path.join(dirname, '.storybook'),
          }),
        ],
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            provider: playwright({}),
            headless: true,
            instances: [{ browser: 'chromium' }],
          },
        },
      },
      {
        test: {
          name: 'performance',
          environment: 'node',
          include: ['test/performance/**/*.test.ts'],
        },
      },
    ],
  },
});
