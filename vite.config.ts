import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
  },
  server: {
    port: 3006,
    hmr: {
      protocol: 'ws',
      host: 'localhost',
    },
    proxy: {
      '/pdf-proxy': {
        target: 'https://firebasestorage.googleapis.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/pdf-proxy/, ''),
        headers: {
          'Origin': 'http://localhost:3006'
        }
      },
      '/pdf-worker': {
        target: 'https://cdnjs.cloudflare.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/pdf-worker/, '/ajax/libs/pdf.js'),
        headers: {
          'Origin': 'http://localhost:3006'
        }
      }
    },
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Goog-Api-Key, X-Goog-AuthUser'
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      'pdfjs-dist': resolve(__dirname, 'node_modules/pdfjs-dist'),
      'pdf.worker': resolve(__dirname, 'node_modules/pdfjs-dist/build/pdf.worker.min.js')
    }
  },
  build: {
    sourcemap: false, // Désactiver les sourcemaps pour réduire la taille
    minify: 'terser', // Utiliser terser pour une meilleure minification
    terserOptions: {
      compress: {
        drop_console: true, // Supprimer les console.log en production
        drop_debugger: true
      }
    },
    commonjsOptions: {
      transformMixedEsModules: true
    },
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          pdfjs: ['pdfjs-dist'],
          'react-pdf': ['react-pdf'],
          mui: ['@mui/material', '@mui/icons-material'],
        },
      },
    },
    chunkSizeWarningLimit: 1000, // Augmenter la limite d'avertissement
  },
  optimizeDeps: {
    include: ['pdfjs-dist/build/pdf', 'pdfjs-dist/build/pdf.worker.min', 'buffer']
  }
}); 