#!/usr/bin/env node
/**
 * Vérifie qu'un fichier d'env existe et contient les variables requises pour le build.
 * Usage :
 *   node scripts/check-env.js
 *   node scripts/check-env.js --env=.env.staging
 * À lancer depuis la racine du projet avant "npm run build" ou "npm run deploy".
 */
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, isAbsolute } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const envArg = process.argv.find((a) => a.startsWith('--env='));
const envRel = envArg ? envArg.slice('--env='.length) : '.env';
const envPath = isAbsolute(envRel) ? envRel : join(root, envRel);
const envLabel = envRel;

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
  console.error(`❌ Fichier ${envLabel} manquant à la racine du projet.`);
  console.error(`   Créez ${envLabel} avec les variables VITE_* (voir .env.example / .env.staging.example).`);
  process.exit(1);
}

const content = readFileSync(envPath, 'utf8');
const missing = required.filter((key) => {
  const re = new RegExp(`^${key}=(.+)`, 'm');
  const m = content.match(re);
  return !m || !m[1].trim();
});

if (missing.length) {
  console.error(`❌ Variables manquantes ou vides dans ${envLabel}:`, missing.join(', '));
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

console.log(`✅ ${envLabel} OK pour le build`);
