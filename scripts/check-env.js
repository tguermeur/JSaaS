#!/usr/bin/env node

/**
 * Script de vérification des variables d'environnement
 * Vérifie que toutes les variables requises sont présentes dans le fichier .env
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const envPath = join(projectRoot, '.env');

// Variables requises pour l'application web (VITE_*)
const requiredViteVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
  // 'VITE_FIREBASE_STORAGE_BUCKET' - optionnel
];

// Variables optionnelles pour l'application web
const optionalViteVars = [
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_STRIPE_PUBLIC_KEY',
  'VITE_APP_URL'
];

// Variables requises pour Firebase Functions
const requiredFunctionVars = [
  'EMAILJS_SERVICE_ID',
  'EMAILJS_TEMPLATE_ID',
  'EMAILJS_USER_ID',
  'EMAILJS_PRIVATE_KEY',
  'GEMINI_API_KEY',
  'FRONTEND_URL',
];

// Variables optionnelles pour Firebase Functions
const optionalFunctionVars = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
];

console.log('🔍 Vérification du fichier .env...\n');

// Vérifier que le fichier existe
if (!existsSync(envPath)) {
  console.error('❌ Fichier .env non trouvé à:', envPath);
  console.error('💡 Créez un fichier .env à la racine du projet');
  process.exit(1);
}

// Lire le fichier .env
let envContent = '';
try {
  envContent = readFileSync(envPath, 'utf8');
} catch (error) {
  console.error('❌ Erreur lors de la lecture du fichier .env:', error.message);
  process.exit(1);
}

// Parser les variables d'environnement
const envVars = {};
const lines = envContent.split('\n');

lines.forEach((line, index) => {
  // Ignorer les lignes vides et les commentaires
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) {
    return;
  }
  
  const match = trimmed.match(/^([^=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    const value = match[2].trim();
    envVars[key] = value;
  }
});

// Fonction pour vérifier les variables
function checkVars(required, optional, category) {
  console.log(`\n📋 ${category}:`);
  
  let hasErrors = false;
  const missing = [];
  const present = [];
  const empty = [];
  
  // Vérifier les variables requises
  required.forEach(varName => {
    if (!(varName in envVars)) {
      missing.push(varName);
      hasErrors = true;
    } else if (!envVars[varName] || envVars[varName].trim() === '') {
      empty.push(varName);
      hasErrors = true;
    } else {
      present.push(varName);
    }
  });
  
  // Vérifier les variables optionnelles
  optional.forEach(varName => {
    if (varName in envVars && envVars[varName] && envVars[varName].trim() !== '') {
      present.push(`${varName} (optionnel)`);
    }
  });
  
  // Afficher les résultats
  present.forEach(varName => {
    const isOptional = varName.includes('(optionnel)');
    const displayName = isOptional ? varName : varName;
    console.log(`  ✅ ${displayName}`);
  });
  
  missing.forEach(varName => {
    console.log(`  ❌ ${varName} - MANQUANTE`);
  });
  
  empty.forEach(varName => {
    console.log(`  ⚠️  ${varName} - DÉFINIE MAIS VIDE`);
  });
  
  return { hasErrors, missing, empty, present: present.length };
}

// Vérifications
const viteResult = checkVars(requiredViteVars, optionalViteVars, 'Variables VITE (Application Web)');
const functionsResult = checkVars(requiredFunctionVars, optionalFunctionVars, 'Variables Firebase Functions');

// Vérifications spécifiques
console.log('\n🔐 Vérifications de sécurité:');

// Vérifier que les clés ne sont pas des valeurs par défaut
const defaultValues = {
  'VITE_FIREBASE_API_KEY': 'AIzaSyCW55pfTJwuRosEx9Sxs-LELEWv1RiS3iI',
};

Object.entries(defaultValues).forEach(([key, defaultValue]) => {
  if (envVars[key] === defaultValue) {
    console.log(`  ⚠️  ${key} utilise une valeur par défaut (potentiellement exposée)`);
  }
});

// Vérifier que FRONTEND_URL est correct
if (envVars.FRONTEND_URL && !envVars.FRONTEND_URL.includes('js-connect.fr')) {
  console.log(`  ⚠️  FRONTEND_URL ne contient pas "js-connect.fr": ${envVars.FRONTEND_URL}`);
} else if (envVars.FRONTEND_URL) {
  console.log(`  ✅ FRONTEND_URL correct: ${envVars.FRONTEND_URL}`);
}

// Résumé
console.log('\n' + '='.repeat(60));
console.log('📊 RÉSUMÉ:');

if (viteResult.hasErrors || functionsResult.hasErrors) {
  console.log('\n❌ Des variables sont manquantes ou vides:');
  
  if (viteResult.missing.length > 0 || viteResult.empty.length > 0) {
    console.log('\n  Variables VITE manquantes/vides:');
    [...viteResult.missing, ...viteResult.empty].forEach(v => console.log(`    - ${v}`));
  }
  
  if (functionsResult.missing.length > 0 || functionsResult.empty.length > 0) {
    console.log('\n  Variables Functions manquantes/vides:');
    [...functionsResult.missing, ...functionsResult.empty].forEach(v => console.log(`    - ${v}`));
  }
  
  console.log('\n💡 Note: Les variables Functions doivent être configurées dans Firebase Console → Functions → Configuration');
  console.log('   Pour l\'environnement local, elles peuvent aussi être dans .env (chargées via dotenv)');
  
  process.exit(1);
} else {
  console.log('\n✅ Toutes les variables requises sont présentes et configurées!');
  console.log(`\n  ✅ ${viteResult.present} variables VITE configurées`);
  console.log(`  ✅ ${functionsResult.present} variables Functions configurées`);
  console.log('\n🎉 Configuration .env valide!');
  process.exit(0);
}
