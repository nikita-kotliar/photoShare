import { defineConfig } from 'vitest/config';
import { mockApiPlugin } from './mock/plugin.js';

export default defineConfig(({ mode }) => {
  const useMock = mode === 'mock';

  return {
    plugins: useMock ? [mockApiPlugin({ delay: Number(process.env.MOCK_DELAY ?? 350) })] : [],
    server: {
      port: 5173,
      proxy: useMock
        ? undefined
        : {
            '/api': {
              target: process.env.VITE_PROXY_TARGET || 'http://localhost:3000',
              changeOrigin: true,
            },
          },
    },
    build: { outDir: 'dist' },
    test: { environment: 'node', include: ['src/**/*.test.js', 'mock/**/*.test.js'] },
  };
});
