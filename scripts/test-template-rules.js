#!/usr/bin/env node

/**
 * Script pour vérifier que les règles templates sont correctement restreintes
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const firestoreRulesPath = path.join(__dirname, '..', 'firestore.rules');
const rulesContent = fs.readFileSync(firestoreRulesPath, 'utf8');

console.log('🔍 Vérification spécifique des règles templates...\n');

// Vérifier que templates a bien une vérification structureId
const templatesRule = rulesContent.match(/match \/templates\/\{templateId\}[\s\S]*?allow read: [\s\S]{0,500}?;/);

if (templatesRule) {
  const ruleText = templatesRule[0];
  
  if (ruleText.includes('structureId')) {
    console.log('✅ La règle templates vérifie bien structureId');
  } else {
    console.log('⚠️  La règle templates ne vérifie pas explicitement structureId dans la lecture');
  }
  
  if (ruleText.includes('getUserData().structureId')) {
    console.log('✅ La règle templates utilise getUserData().structureId pour la vérification');
  }
  
  if (ruleText.includes('allow read: if request.auth != null')) {
    console.log('❌ PROBLÈME: templates permet la lecture à tous les utilisateurs authentifiés');
  } else {
    console.log('✅ templates a des restrictions de lecture');
  }
} else {
  console.log('❌ Règle templates non trouvée');
}

console.log('\n' + '='.repeat(60));
console.log('Résumé: Vérifiez manuellement que templates est bien restreint par structureId');
