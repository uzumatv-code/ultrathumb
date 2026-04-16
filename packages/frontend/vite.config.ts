import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const apiProxyTarget = process.env.API_URL ?? 'http://localhost:4000';

const apiProxyConfig = {
  '/api': {
    target: apiProxyTarget,
    changeOrigin: true,
  },
  '/webhooks': {
    target: apiProxyTarget,
    changeOrigin: true,
  },
  '/socket.io': {
    target: apiProxyTarget,
    changeOrigin: true,
    ws: true,
  },
};

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: apiProxyConfig,
  },
  preview: {
    port: 3000,
    proxy: apiProxyConfig,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          router: ['react-router-dom'],
          query: ['@tanstack/react-query'],
          canvas: ['react-konva', 'konva'],
          motion: ['framer-motion'],
        },
      },
    },
  },
});
