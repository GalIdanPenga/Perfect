import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
    return {
      server: {
        port: 5173,
        host: '0.0.0.0',
      },
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      test: {
        environment: 'node',
        globals: true,
        setupFiles: ['./src/test/setup.ts'],
        include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'server/**/*.test.ts'],
        // Server tests run in node. Every frontend suite (src/components, src/hooks,
        // src/App.test.tsx) must carry a `// @vitest-environment happy-dom` docblock;
        // Vitest 4 dropped `environmentMatchGlobs`, so the docblock is the only switch.
        // Isolate the server DB singleton from the real flows.db during tests.
        env: {
          PERFECT_DB_PATH: ':memory:',
        },
        coverage: {
          provider: 'v8',
          reporter: ['text', 'html'],
          include: ['src/**', 'server/**'],
          exclude: ['**/*.test.{ts,tsx}', 'src/test/**', 'server/types/**'],
        },
      }
    };
});
