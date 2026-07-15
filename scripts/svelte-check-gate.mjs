// Ratchet gate for svelte-check: fails only if the error count grows above
// the committed baseline. The codebase has a backlog of ~150 type errors;
// this prevents new ones and nudges the baseline down as they're fixed.
// Lower the number in .svelte-check-baseline whenever you reduce errors.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const BASELINE_FILE = '.svelte-check-baseline';
const baseline = parseInt(readFileSync(BASELINE_FILE, 'utf8').trim(), 10);

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

const m = output.match(/found (\d+) errors/);
const errors = m ? parseInt(m[1], 10) : 0;

console.log(`svelte-check: ${errors} errors (baseline ${baseline})`);

if (errors > baseline) {
  console.error(`\n❌ svelte-check errors increased: ${errors} > baseline ${baseline}.`);
  console.error('Fix the new type error(s), or run `yarn check` to see them.');
  process.exit(1);
}

if (errors < baseline) {
  writeFileSync(BASELINE_FILE, `${errors}\n`);
  console.error(`\n✅ Errors decreased to ${errors} — lowering the baseline.`);
  console.error('Commit the updated .svelte-check-baseline to lock in the win.');
}

console.log('✅ svelte-check within baseline.');
