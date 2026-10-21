import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
 server: {
  proxy: {
    '/api': {
      target: 'https://smartx.shivinfotech.co.in',
      changeOrigin: true,
      secure: false,
      rewrite: (path) => path.replace(/^\/api/, ''),
    },
    '/stipl': {
      target: 'https://stipldrive.ddns.net',
      changeOrigin: true,
      secure: false,
      rewrite: (path) => path.replace(/^\/stipl/, ''),
    },
  },
},
  preview: {
  proxy: {
    '/stipl': {
      target: 'https://stipldrive.ddns.net',
      changeOrigin: true,
      secure: false,
      rewrite: (path) => path.replace(/^\/stipl/, ''),
    },
  },
},
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          motion: ['framer-motion'],
        },
      },
    },
  },
});