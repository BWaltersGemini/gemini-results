// vite.config.js ← MUST BE EXACTLY THIS
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
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