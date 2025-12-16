// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react({ babel: { presets: ['@babel/preset-env', '@babel/preset-react'] } })],
  base: '/', // Forces absolute paths for built assets — fixes refresh/MIME issues on Vercel
  build: {
    target: 'es2015' // Ensure ES5-compatible output for older iOS
  },
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