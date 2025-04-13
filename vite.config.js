import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'fs';

// Custom plugin to handle WebAssembly files
const wasmContentTypePlugin = {
  name: 'wasm-content-type',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url.endsWith('.wasm')) {
        res.setHeader('Content-Type', 'application/wasm');
      }
      next();
    });
  }
};

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    wasmContentTypePlugin
  ],
  css: {
    postcss: './postcss.config.js',
  },
  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
  optimizeDeps: {
    exclude: ['sql.js']
  }
}); 