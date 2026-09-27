import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['src/**/__tests__/**/*.test.ts', 'supabase/functions/**/__tests__/**/*.test.ts'] },
});
