// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteCommonjs } from '@originjs/vite-plugin-commonjs';  // Add this

export default defineConfig({
  plugins: [
    viteCommonjs(),  // Add first
    react()
  ],
  base: '/',
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
  }
});