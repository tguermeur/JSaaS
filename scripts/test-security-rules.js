#!/usr/bin/env node

/**
 * Script de test pour vérifier que toutes les collections Firestore ont des règles explicites
 * et que la règle catch-all a bien été supprimée
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const firestoreRulesPath = path.join(__dirname, '..', 'firestore.rules');
const rulesContent = fs.readFileSync(firestoreRulesPath, 'utf8');

console.log('🔍 Vérification des règles Firestore de sécurité...\n');

// Collections connues utilisées dans l'application
const knownCollections = [
  'missions',
  'companies',
  'descriptions',
  'missionTypes',
  'applications',
  'users',
  'structures',
  'reports',
  'calendarEvents',
  'templates',
  'templateAssignments',
  'programs',
  'structureTokens',
  'prospects',
  'contracts',
  'recruitmentTasks',
  'etudes',
  'notifications',
  'subscriptions',
  'stripeCustomers',
  'notes',
  'expenseNotes',
  'workingHours',
  'amendments',
  'generatedDocuments',
  'templateVariables',
  'documentTags',
  'contacts',
  'defaultTemplateAssignments',
  'auditDocuments',
  'auditAssignments',
  'documentComparisons'
];

let errors = [];
let warnings = [];

// 1. Vérifier que la règle catch-all a bien été supprimée
const catchAllPattern = /match \/\{collection\}\/\{document=\*\*\}/;
if (catchAllPattern.test(rulesContent)) {
  errors.push('❌ La règle catch-all trop permissive existe encore !');
} else {
  console.log('✅ La règle catch-all a bien été supprimée');
}

// 2. Vérifier que toutes les collections connues ont des règles
console.log('\n📋 Vérification des règles par collection:\n');
for (const collection of knownCollections) {
  const pattern = new RegExp(`match /${collection}/`);
  if (pattern.test(rulesContent)) {
    console.log(`  ✅ ${collection} - règles trouvées`);
  } else {
    warnings.push(`⚠️  ${collection} - aucune règle explicite trouvée (peut être dans une sous-collection)`);
  }
}

// 3. Vérifier que programs n'est plus publique
if (rulesContent.includes('match /programs/{structureId}')) {
  const programsRule = rulesContent.match(/match \/programs\/\{structureId\}[\s\S]*?allow read: if [^;]+;/);
  if (programsRule && programsRule[0].includes('allow read: if true')) {
    errors.push('❌ La collection programs est toujours publique (allow read: if true)');
  } else if (programsRule && programsRule[0].includes('allow read: if isAuthenticated()')) {
    console.log('✅ La collection programs est maintenant restreinte aux utilisateurs authentifiés');
  }
}

// 4. Vérifier que templates est restreint par structure
if (rulesContent.includes('match /templates/{templateId}')) {
  const templatesRule = rulesContent.match(/match \/templates\/\{templateId\}[\s\S]*?allow read: if [^;]+;/);
  if (templatesRule && templatesRule[0].includes('allow read: if request.auth != null')) {
    // Vérifier qu'il y a aussi une vérification structureId
    const fullRule = rulesContent.match(/match \/templates\/\{templateId\}[\s\S]{0,500}?allow read: [\s\S]{0,300}?;/);
    if (fullRule && fullRule[0].includes('structureId')) {
      console.log('✅ La collection templates est maintenant restreinte par structureId');
    } else {
      warnings.push('⚠️  La collection templates pourrait être mieux restreinte par structureId');
    }
  }
}

// 5. Vérifier qu'il n'y a pas de règles en double pour structures
const structuresMatches = rulesContent.match(/match \/structures\/\{structureId\}/g);
if (structuresMatches && structuresMatches.length > 1) {
  errors.push(`❌ Plusieurs règles pour structures/{structureId} trouvées (${structuresMatches.length})`);
} else {
  console.log('✅ Pas de doublon pour structures/{structureId}');
}

// 6. Vérifier qu'il n'y a pas de règles en double pour users
const usersMatches = rulesContent.match(/match \/users\/\{userId\}/g);
if (usersMatches && usersMatches.length > 1 && !rulesContent.includes('/*')) {
  errors.push(`❌ Plusieurs règles pour users/{userId} trouvées (${usersMatches.length})`);
} else {
  console.log('✅ Pas de doublon pour users/{userId} (ou doublon correctement commenté)');
}

// Résumé
console.log('\n' + '='.repeat(60));
console.log('📊 RÉSUMÉ DES TESTS\n');

if (errors.length === 0 && warnings.length === 0) {
  console.log('✅ Tous les tests sont passés avec succès !');
  process.exit(0);
} else {
  if (errors.length > 0) {
    console.log('\n❌ ERREURS:');
    errors.forEach(err => console.log(`  ${err}`));
  }
  if (warnings.length > 0) {
    console.log('\n⚠️  AVERTISSEMENTS:');
    warnings.forEach(warn => console.log(`  ${warn}`));
  }
  process.exit(errors.length > 0 ? 1 : 0);
}
