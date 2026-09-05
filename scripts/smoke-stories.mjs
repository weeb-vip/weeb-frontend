/**
 * Renders every story in a running Storybook and reports the ones that throw.
 *
 * `build-storybook` only compiles -- it never mounts a story -- so a story can
 * build clean and still blow up the moment it renders. This is the gate that
 * actually catches that.
 */
import { chromium } from '@playwright/test';

const BASE = process.env.SB_URL ?? 'http://localhost:6006';
const CONCURRENCY = Number(process.env.SB_CONCURRENCY ?? 6);

const index = await (await fetch(`${BASE}/index.json`)).json();
const stories = Object.values(index.entries ?? index.stories ?? {}).filter(
  (e) => e.type !== 'docs',
);
console.log(`found ${stories.length} stories`);

const browser = await chromium.launch();
const failures = [];
let done = 0;

async function worker(queue) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message ?? e)));
  // Only Storybook's own render failure counts from the console. The app's
  // debug.error goes to console.error too, and the error-state stories call it
  // on purpose -- "Login failed", "All image sources failed" and friends are
  // the story working, not breaking.
  page.on('console', (m) => {
    if (m.type() === 'error' && /Error rendering story|Unable to render|storyFn/i.test(m.text())) {
      errors.push(m.text());
    }
  });

  for (const story of queue) {
    errors.length = 0;
    try {
      await page.goto(`${BASE}/iframe.html?id=${encodeURIComponent(story.id)}&viewMode=story`, {
        waitUntil: 'networkidle',
        timeout: 30000,
      });
      // Storybook marks a rendered story on the body; wait for it rather than
      // guessing at a fixed delay.
      await page
        .waitForFunction(
          () => document.body?.classList.contains('sb-show-main') || document.querySelector('#storybook-root')?.children.length,
          { timeout: 15000 },
        )
        .catch(() => {});
    } catch (e) {
      errors.push(`navigation: ${String(e.message ?? e)}`);
    }

    // Ignore noise that is not a render failure.
    const real = errors.filter(
      (e) =>
        !/favicon|Failed to load resource.*40[34]|ERR_(NAME_NOT_RESOLVED|INTERNET_DISCONNECTED|CONNECTION_REFUSED)|net::ERR_/i.test(e),
    );
    if (real.length) failures.push({ id: story.id, title: story.title, errors: [...new Set(real)].slice(0, 3) });

    done += 1;
    if (done % 50 === 0) console.log(`  ...${done}/${stories.length}`);
  }
  await page.close();
}

const chunks = Array.from({ length: CONCURRENCY }, () => []);
stories.forEach((s, i) => chunks[i % CONCURRENCY].push(s));
await Promise.all(chunks.map(worker));
await browser.close();

console.log(`\n=== ${failures.length} failing of ${stories.length} ===`);
for (const f of failures) {
  console.log(`\n✗ ${f.title} :: ${f.id}`);
  for (const e of f.errors) console.log(`    ${e.split('\n')[0].slice(0, 200)}`);
}
process.exit(failures.length ? 1 : 0);
