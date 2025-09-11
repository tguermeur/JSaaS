import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  // Charger les variables d'environnement
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  return {
    build: {
      outDir: 'dist/extension',
      rollupOptions: {
        input: {
          popup: resolve(__dirname, 'src/extension/popup.html'),
          background: resolve(__dirname, 'src/extension/background.js')
        },
        output: {
          entryFileNames: '[name].js',
          chunkFileNames: '[name].js',
          assetFileNames: '[name].[ext]'
        }
      }
    },
    define: {
      'process.env': {
        VITE_FIREBASE_API_KEY: JSON.stringify(env.VITE_FIREBASE_API_KEY),
        VITE_FIREBASE_AUTH_DOMAIN: JSON.stringify(env.VITE_FIREBASE_AUTH_DOMAIN),
        VITE_FIREBASE_PROJECT_ID: JSON.stringify(env.VITE_FIREBASE_PROJECT_ID),
        VITE_FIREBASE_STORAGE_BUCKET: JSON.stringify(env.VITE_FIREBASE_STORAGE_BUCKET),
        VITE_FIREBASE_MESSAGING_SENDER_ID: JSON.stringify(env.VITE_FIREBASE_MESSAGING_SENDER_ID),
        VITE_FIREBASE_APP_ID: JSON.stringify(env.VITE_FIREBASE_APP_ID)
      }
    }
  };
}); 