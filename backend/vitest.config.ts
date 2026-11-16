import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`. Requires Vite 8, which ships this option.
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      exclude: [
        'src/generated/**',
        'src/**/*.module.ts',
        'src/**/*.dto.ts',
        'src/main.ts',
        'src/**/*.spec.ts',
        'test/**',
        'node_modules/**',
      ],
    },
  },
});
