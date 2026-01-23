/**
 * Script utilitaire pour générer une clé de chiffrement
 * 
 * Usage: node -r ts-node/register src/generateKey.ts
 * ou après compilation: node lib/generateKey.js
 */

import * as crypto from 'crypto';

function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

if (require.main === module) {
  const key = generateEncryptionKey();
  console.log('\n🔑 Clé de chiffrement générée :\n');
  console.log(key);
  console.log('\n⚠️  IMPORTANT : Sauvegardez cette clé dans un endroit sûr !');
  console.log('📝 Pour l\'ajouter à Firebase Secrets :');
  console.log('   firebase functions:secrets:set ENCRYPTION_KEY\n');
}

export { generateEncryptionKey };
