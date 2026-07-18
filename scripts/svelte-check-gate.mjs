// Ratchet gate for svelte-check: fails if the error or warning count grows
// above the committed baseline. Both are at 0 — the gate now simply blocks
// any new svelte-check diagnostic. The baseline file holds "errors warnings".
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const BASELINE_FILE = '.svelte-check-baseline';
const [baseErrors, baseWarnings = Infinity] = readFileSync(BASELINE_FILE, 'utf8')
  .trim()
  .split(/\s+/)
  .map(Number);

let output = '';
try {
  output = execSync('npx svelte-check --tsconfig ./tsconfig.json --output human', {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
} catch (e) {
  // svelte-check exits non-zero when there are errors; capture its output
  output = (e.stdout || '') + (e.stderr || '');
}

const m = output.match(/found (\d+) errors and (\d+) warnings/);
const errors = m ? parseInt(m[1], 10) : 0;
const warnings = m ? parseInt(m[2], 10) : 0;

console.log(`svelte-check: ${errors} errors (baseline ${baseErrors}), ${warnings} warnings (baseline ${baseWarnings})`);

if (errors > baseErrors || warnings > baseWarnings) {
  console.error(`\n❌ svelte-check diagnostics increased above baseline.`);
  console.error('Fix the new error(s)/warning(s), or run `yarn check` to see them.');
  process.exit(1);
}

if (errors < baseErrors || warnings < baseWarnings) {
  writeFileSync(BASELINE_FILE, `${errors} ${warnings}\n`);
  console.error(`\n✅ Diagnostics decreased — lowering the baseline.`);
  console.error('Commit the updated .svelte-check-baseline to lock in the win.');
}

console.log('✅ svelte-check within baseline.');
