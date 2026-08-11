#!/usr/bin/env node
/**
 * Functions lint gate with a hard warning ceiling.
 * Baseline measured on chore/ci-hygiene-lint: must decrease over time, never raise.
 */
import { spawnSync } from 'node:child_process';

/** @type {number} Absolute max of ESLint warnings. Ratchet DOWN only. */
const FUNCTIONS_LINT_WARNING_CEILING = 165;

const result = spawnSync('npm', ['run', 'lint:functions'], {
  encoding: 'utf8',
  shell: true,
});

const output = `${result.stdout || ''}${result.stderr || ''}`;
const summaryMatch = output.match(
  /(\d+)\s+problems?\s+\((\d+)\s+errors?,\s*(\d+)\s+warnings?\)/
);

const errorCount = summaryMatch ? Number(summaryMatch[2]) : 0;
const warningCount = summaryMatch ? Number(summaryMatch[3]) : 0;

// No summary + non-zero exit usually means eslint crashed or could not run.
if (!summaryMatch && result.status !== 0) {
  console.error('lint:functions: failed to produce an ESLint summary:\n' + output);
  process.exit(1);
}

if (errorCount > 0) {
  console.error(
    `lint:functions: ${errorCount} error(s) reported — errors are not covered by the warning ceiling. Fix them.`
  );
  process.exit(1);
}

if (warningCount > FUNCTIONS_LINT_WARNING_CEILING) {
  console.error(
    `lint:functions: ${warningCount} warnings exceeds ceiling ${FUNCTIONS_LINT_WARNING_CEILING}. ` +
      'Fix lint warnings or (only if justified) update the ceiling downward after a real reduction.'
  );
  process.exit(1);
}

console.log(
  `lint:functions: ${warningCount} warnings (ceiling ${FUNCTIONS_LINT_WARNING_CEILING}, ` +
    `${FUNCTIONS_LINT_WARNING_CEILING - warningCount} under budget)`
);
process.exit(0);
