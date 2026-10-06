import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    format: ['cjs', 'esm'],
    target: 'node18',
    platform: 'node',
    dts: true,
    clean: true,
  },
  {
    entry: { browser: 'src/browser.ts' },
    format: ['cjs', 'esm', 'iife'],
    target: 'es2020',
    platform: 'browser',
    globalName: 'XanPayBrowser',
    dts: true,
    clean: false,
  },
]);
