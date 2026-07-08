import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 5173,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
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
        // Frontend suites also declare `// @vitest-environment happy-dom` inline,
        // which wins over config. Route the same globs to happy-dom so the two
        // agree (jsdom is no longer used); node stays the default for server tests.
        environmentMatchGlobs: [
          ['src/components/**/*.test.tsx', 'happy-dom'],
          ['src/hooks/**/*.test.ts', 'happy-dom'],
          ['src/hooks/**/*.test.tsx', 'happy-dom'],
          ['src/App.test.tsx', 'happy-dom'],
        ],
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
