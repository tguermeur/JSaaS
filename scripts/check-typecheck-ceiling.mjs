#!/usr/bin/env node
/**
 * Typecheck gate with a hard error ceiling.
 * Baseline measured on LOT 2 (fix/ci-pipeline): must decrease over time, never raise.
 */
import { spawnSync } from 'node:child_process';

/** @type {number} Absolute max of `error TS` lines. Ratchet DOWN only. */
const TYPECHECK_ERROR_CEILING = 1291;

const result = spawnSync(
  'npx',
  ['tsc', '--noEmit', '-p', 'tsconfig.json'],
  { encoding: 'utf8', shell: true }
);

const output = `${result.stdout || ''}${result.stderr || ''}`;
const errorCount = (output.match(/error TS\d+/g) || []).length;

if (errorCount > TYPECHECK_ERROR_CEILING) {
  console.error(
    `typecheck: ${errorCount} errors exceeds ceiling ${TYPECHECK_ERROR_CEILING}. ` +
      'Fix type errors or (only if justified) update the ceiling downward after a real reduction.'
  );
  process.exit(1);
}

console.log(
  `typecheck: ${errorCount} errors (ceiling ${TYPECHECK_ERROR_CEILING}, ` +
    `${TYPECHECK_ERROR_CEILING - errorCount} under budget)`
);
process.exit(0);
