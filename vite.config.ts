import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base keeps the build loadable from a Capacitor webview (file://).
  base: './',
  // Expose dev server on LAN so phones can test touch input.
  server: { host: true },
  build: { target: 'es2022' },
});
