// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  // This makes all asset paths relative (./assets/...) instead of absolute (/)
  This is REQUIRED for Vercel/Netlify SPAs when using client-side routing
  Without it → refresh on /results → MIME type error + blank page
  base: './',

  server: {
    proxy: {
      '/runsignup-api': {
        target: 'https://api.runsignup.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/runsignup-api/, ''),
      },
      '/chrono-api': {
        target: 'https://api.chronotrack.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/chrono-api/, '')
      },
      '/chrono-test-api': {
        target: 'https://api-test.chronotrack.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/chrono-test-api/, '')
      },
    },
  },
});