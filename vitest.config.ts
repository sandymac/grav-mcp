import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    root: '/Users/rhuk/workspace/grav-mcp',
    include: ['tests/unit/**/*.test.ts'],
    globals: true,
    setupFiles: ['tests/setup.ts'],
    testTimeout: 10000,
  },
});
