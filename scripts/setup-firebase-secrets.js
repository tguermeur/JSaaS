#!/usr/bin/env node

/**
 * Script pour configurer tous les secrets Firebase Functions depuis le fichier .env
 * Usage: node scripts/setup-firebase-secrets.js
 */

import { readFileSync, existsSync, writeFileSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { tmpdir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const envPath = join(projectRoot, '.env');

// Variables à configurer comme secrets Firebase Functions
const secretsToSet = [
  'EMAILJS_SERVICE_ID',
  'EMAILJS_TEMPLATE_ID',
  'EMAILJS_TEMPLATE_ID_AMBASSADOR', // optionnel ; template dédié invitations ambassadeurs
  'EMAILJS_USER_ID',
  'EMAILJS_PRIVATE_KEY',
  'GEMINI_API_KEY',
  // FRONTEND_URL : exclu des secrets pour éviter "overlaps non secret" au deploy.
  // Définir en var. d’env. non secrète (Console Firebase ou functions/.env).
  'STRIPE_SECRET_KEY', // Optionnel
  'STRIPE_WEBHOOK_SECRET', // Optionnel
];

console.log('🔐 Configuration des secrets Firebase Functions...\n');
console.log('⚠️  IMPORTANT: Vous devez être connecté à Firebase avant de continuer.');
console.log('   Si ce n\'est pas le cas, exécutez: firebase login --reauth\n');

// Vérifier que le fichier .env existe
if (!existsSync(envPath)) {
  console.error('❌ Fichier .env non trouvé à:', envPath);
  process.exit(1);
}

// Parser le fichier .env
function loadEnvFile(envPath) {
  const env = {};
  const content = readFileSync(envPath, 'utf8');
  const lines = content.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      env[key] = value;
    }
  }
  
  return env;
}

const envVars = loadEnvFile(envPath);

// Fonction pour définir un secret Firebase
function setSecret(key, value) {
  if (!value || value.trim() === '') {
    console.log(`⏭️  ${key} - Non définie, ignorée`);
    return false;
  }
  
  const tmpPath = join(tmpdir(), `firebase-secret-${key}-${Date.now()}`);
  try {
    console.log(`📝 Configuration de ${key}...`);
    // Fichier temporaire sans saut de ligne (évite "Public Key is invalid" etc.)
    writeFileSync(tmpPath, value, 'utf8');
    execSync(`firebase functions:secrets:set ${key} --data-file "${tmpPath}"`, {
      stdio: 'inherit',
      cwd: projectRoot
    });
    console.log(`✅ ${key} configuré avec succès\n`);
    return true;
  } catch (error) {
    console.error(`❌ Erreur lors de la configuration de ${key}:`, error.message);
    return false;
  } finally {
    try {
      unlinkSync(tmpPath);
    } catch (_) {}
  }
}

// Configurer tous les secrets
console.log('Les secrets suivants seront configurés:\n');
secretsToSet.forEach(key => {
  if (envVars[key]) {
    console.log(`  ✅ ${key} - Valeur trouvée dans .env`);
  } else {
    console.log(`  ⚠️  ${key} - Non trouvée dans .env (optionnelle)`);
  }
});

console.log('\n' + '='.repeat(60));
console.log('Démarrage de la configuration...\n');

let successCount = 0;
let skipCount = 0;
let errorCount = 0;

for (const key of secretsToSet) {
  const value = envVars[key];
  if (!value || value.trim() === '') {
    skipCount++;
    continue;
  }
  
  if (setSecret(key, value)) {
    successCount++;
  } else {
    errorCount++;
  }
}

// Résumé
console.log('\n' + '='.repeat(60));
console.log('📊 RÉSUMÉ:');
console.log(`  ✅ ${successCount} secrets configurés avec succès`);
if (skipCount > 0) {
  console.log(`  ⏭️  ${skipCount} secrets ignorés (non définis ou optionnels)`);
}
if (errorCount > 0) {
  console.log(`  ❌ ${errorCount} erreurs`);
}

if (errorCount === 0) {
  console.log('\n🎉 Configuration terminée avec succès!');
  console.log('\n💡 Note: Les secrets sont maintenant disponibles dans vos Cloud Functions');
  console.log('   Vous pouvez les utiliser via process.env.NOM_DU_SECRET');
} else {
  console.log('\n⚠️  Certaines erreurs sont survenues. Vérifiez les messages ci-dessus.');
  process.exit(1);
}
