// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteCommonjs } from '@originjs/vite-plugin-commonjs';  // Add this import

export default defineConfig({
  plugins: [
    viteCommonjs(),  // Add this before react()
    react({
      babel: {
        presets: ['@babel/preset-env', '@babel/preset-react']
      }
    })
  ],
  base: '/',
  build: {
    target: 'es2015'  // Helps with older browser compatibility
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