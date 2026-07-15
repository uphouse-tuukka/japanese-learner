/// <reference types="vitest/config" />
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.browser.test.ts'],
          environment: 'node',
        },
      },
      {
        extends: true,
        resolve: {
          conditions: ['browser'],
        },
        test: {
          name: 'browser-like',
          include: ['src/**/*.browser.test.ts'],
          environment: 'happy-dom',
          server: {
            deps: {
              inline: [/^svelte/],
            },
          },
        },
      },
    ],
  },
});
