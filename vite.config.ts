import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ['.manus.computer'],
    // Dev-only replacement for Angular's proxy.conf.json:
    // /api/home/userlogin  ->  https://smartx.shivinfotech.co.in/home/userlogin
    proxy: {
      '/api': {
        target: 'https://smartx.shivinfotech.co.in',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ''),
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
