#!/usr/bin/env node
/**
 * Vérifie que .env existe et contient les variables requises pour le build (production).
 * À lancer depuis la racine du projet avant "npm run build" ou "npm run deploy".
 */
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const envPath = join(root, '.env');

const required = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
];

const recommended = [
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_GA_MEASUREMENT_ID',
];

if (!existsSync(envPath)) {
  console.error('❌ Fichier .env manquant à la racine du projet.');
  console.error('   Créez .env avec les variables VITE_* (voir .env.example si présent).');
  process.exit(1);
}

const content = readFileSync(envPath, 'utf8');
const missing = required.filter((key) => {
  const re = new RegExp(`^${key}=(.+)`, 'm');
  const m = content.match(re);
  return !m || !m[1].trim();
});

if (missing.length) {
  console.error('❌ Variables manquantes ou vides dans .env:', missing.join(', '));
  process.exit(1);
}

const missingRecommended = recommended.filter((key) => {
  const re = new RegExp(`^${key}=(.+)`, 'm');
  const m = content.match(re);
  return !m || !m[1].trim();
});
if (missingRecommended.length) {
  console.warn('⚠️  Variables recommandées absentes:', missingRecommended.join(', '));
}

console.log('✅ .env OK pour le build');
