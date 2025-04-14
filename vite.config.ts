import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/FrameData',
  plugins: [
    react({
      babel: {
        plugins: [
          ["babel-plugin-react-compiler", { /* Options (if any) */ }],
        ],
      },
    }),
  ],
  server: {
    port: 3000,
    open: true
  },
  build: {
    sourcemap: true
  },
  esbuild: {
    drop: process.env.NODE_ENV === 'production' ? ['debugger'] : []
  }
}); 