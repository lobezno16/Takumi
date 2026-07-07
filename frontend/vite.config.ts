import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Keep the map/chart/animation vendors in their own cacheable chunks.
    rollupOptions: {
      output: {
        manualChunks: {
          maplibre: ['maplibre-gl'],
          charts: ['recharts'],
          motion: ['motion'],
        },
      },
    },
  },
  server: {
    // Poll the filesystem so hot-reload works through Docker bind mounts on
    // Windows/macOS, where native file-change events are not propagated.
    watch: { usePolling: true, interval: 300 },
    // In Docker the backend is reachable by service name; for host-based dev
    // set VITE_PROXY_TARGET=http://localhost:8000.
    proxy: (() => {
      const target = process.env.VITE_PROXY_TARGET ?? 'http://backend:8000';
      return {
        '/api': { target, changeOrigin: true },
        '/ws': { target: target.replace(/^http/, 'ws'), ws: true },
      };
    })(),
  },
});
