#!/usr/bin/env node
/**
 * Garde-fou avant un déploiement production.
 * Affiche le projet Firebase actif, exige la saisie de jsaas-dd2f7, refuse sinon.
 */
import { createInterface } from 'readline';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const PROD_PROJECT_ID = 'jsaas-dd2f7';
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function getActiveProjectId() {
  try {
    const out = execSync('npx firebase use', {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    // Ex. "Active Project: jsaas-dd2f7" ou alias résolu
    const activeMatch = out.match(/Active Project:\s*(\S+)/i);
    if (activeMatch) return activeMatch[1].replace(/[()]/g, '');
    const usingMatch = out.match(/Now using project\s+(\S+)/i);
    if (usingMatch) return usingMatch[1];
    // Fallback : première ligne non vide contenant un project id connu
    const line = out
      .split('\n')
      .map((l) => l.trim())
      .find((l) => /jsaas-/.test(l));
    if (line) {
      const id = line.match(/(jsaas-[a-z0-9]+)/);
      if (id) return id[1];
    }
  } catch (err) {
    console.error('Impossible de déterminer le projet Firebase actif.');
    console.error(err?.stderr?.toString?.() || err.message);
    process.exit(1);
  }
  return null;
}

function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

const active = getActiveProjectId();
console.log('');
console.log('══════════════════════════════════════════');
console.log('  CONFIRMATION DÉPLOIEMENT PRODUCTION');
console.log('══════════════════════════════════════════');
console.log(`  Projet Firebase actif : ${active || '(inconnu)'}`);
console.log(`  Projet attendu        : ${PROD_PROJECT_ID}`);
console.log('══════════════════════════════════════════');
console.log('');

if (!active) {
  console.error('Refus : projet actif introuvable. Exécutez `firebase use prod` puis réessayez.');
  process.exit(1);
}

if (active !== PROD_PROJECT_ID) {
  console.error(
    `Refus : le projet actif (${active}) n'est pas la production (${PROD_PROJECT_ID}).`
  );
  console.error('Basculez avec `firebase use prod` avant de déployer en production.');
  process.exit(1);
}

if (!process.stdin.isTTY) {
  console.error('Refus : confirmation interactive requise (stdin n\'est pas un TTY).');
  process.exit(1);
}

const answer = await ask(`Pour confirmer, saisissez exactement « ${PROD_PROJECT_ID} » : `);

if (answer !== PROD_PROJECT_ID) {
  console.error('Confirmation incorrecte — déploiement annulé.');
  process.exit(1);
}

console.log('Confirmation OK — déploiement production autorisé.\n');
