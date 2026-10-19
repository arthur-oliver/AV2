import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    fileParallelism: false, // os testes de integração compartilham o mesmo banco
    testTimeout: 30000,
    hookTimeout: 30000
  }
});
