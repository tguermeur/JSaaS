#!/usr/bin/env node
/**
 * Vérifie la taille des chunks de pages lourdes (hors vendors pdf/firebase déjà isolés).
 * Usage: node scripts/check-bundle-size.mjs
 */
import { readdirSync, statSync } from 'fs';
import { join } from 'path';

const distAssets = join(process.cwd(), 'dist', 'assets');

/** Fichiers attendus (sous-chaîne du hash Vite) et seuil brut KiB. */
const ROUTE_CHUNK_LIMITS = [
  { match: /^MissionDetails-/, maxKb: 400 },
  { match: /^EtudeDetails-/, maxKb: 400 },
  { match: /^Dashboard-/, maxKb: 350 },
];

let failed = false;
try {
  const files = readdirSync(distAssets).filter((f) => f.endsWith('.js'));
  const sizes = files.map((f) => ({ name: f, bytes: statSync(join(distAssets, f)).size }));

  console.log('Contrôle chunks routes:');
  for (const { match, maxKb } of ROUTE_CHUNK_LIMITS) {
    const found = sizes.find((s) => match.test(s.name));
    if (!found) {
      console.log(`  ${match}: (absent — skip)`);
      continue;
    }
    const kb = Math.round(found.bytes / 1024);
    const ok = kb <= maxKb;
    if (!ok) failed = true;
    console.log(`  ${found.name}: ${kb} KiB (max ${maxKb}) ${ok ? 'OK' : 'FAIL'}`);
  }

  const heavy = sizes.sort((a, b) => b.bytes - a.bytes).slice(0, 5);
  console.log('\nTop 5 chunks (info):');
  for (const { name, bytes } of heavy) {
    console.log(`  ${name}: ${Math.round(bytes / 1024)} KiB`);
  }

  if (failed) {
    console.error('\nUn chunk route dépasse le seuil. Voir npm run build:analyze.');
    process.exit(1);
  }
  console.log('\nBundle route chunks OK.');
} catch {
  console.error('dist/assets introuvable — exécutez npm run build avant ce script.');
  process.exit(1);
}
