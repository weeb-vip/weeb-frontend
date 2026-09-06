import { expect, type Page } from '@playwright/test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

/**
 * Wait for page to be ready with explicit element checks instead of networkidle.
 * networkidle waits for ALL network requests which is unreliable with external APIs.
 */
export async function waitForPageReady(page: Page, options?: {
  selector?: string;
  timeout?: number;
}) {
  const { selector = 'body', timeout = 15000 } = options || {};

  // Wait for DOM content loaded first
  await page.waitForLoadState('domcontentloaded');

  // Then wait for the specific element to be visible
  await page.locator(selector).first().waitFor({ state: 'visible', timeout });
}

/**
 * Wait for homepage to be ready - checks for nav/header
 */
export async function waitForHomepage(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  // Wait for navigation to be visible (indicates hydration complete)
  await page.locator('nav, header').first().waitFor({ state: 'visible', timeout: 15000 });
}

/**
 * Wait for season page to be ready - checks for season heading
 */
export async function waitForSeasonPage(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  // Wait for the season heading to appear
  await page.getByRole('heading', { level: 1 }).waitFor({ state: 'visible', timeout: 15000 });
}

/**
 * Wait for a season's grid to settle, whether or not it has anime in it.
 *
 * Navigation tests need to know the page has hydrated before clicking, and used
 * to wait on an anime card to decide that. That couples them to the API having
 * data: when the seasonal query fails or the season is genuinely empty, the wait
 * times out and a navigation test reports a failure that has nothing to do with
 * navigation. It also reports it as a bare locator timeout, which says nothing
 * about the real cause.
 *
 * Cards or the empty state both mean the same thing here -- the grid rendered.
 */
export async function waitForSeasonGrid(page: Page) {
  const animeCards = page.locator('a[href^="/anime/"]');
  const emptyState = page.locator('text=No anime found');
  await expect(animeCards.first().or(emptyState)).toBeVisible({ timeout: 15000 });
}

/**
 * Wait for auth page form to be ready
 */
export async function waitForAuthForm(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  // Wait for form to be visible (indicates hydration complete)
  await page.locator('form').first().waitFor({ state: 'visible', timeout: 15000 });
}

/**
 * Wait for show detail page - handles both success and 404 cases
 */
export async function waitForShowPage(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  // Wait for main content area
  await page.locator('main, body').first().waitFor({ state: 'visible', timeout: 15000 });
}

/* ------------------------------------------------------------------ *
 * Mailpit
 *
 * Two things used to make the mail-dependent specs fail in a full run while
 * passing in isolation, and neither of them was "the inbox service is down".
 *
 * 1. Both helpers below read `/api/v1/messages`, which returns the *first page*
 *    of the mailbox. The shared staging mailbox sits at several hundred
 *    messages, so a scan of the first 50 answers "is this address in the
 *    newest 50?", not "did this address get mail?". Worse, the cleanup helper
 *    had the same blind spot, so it deleted almost nothing and the mailbox only
 *    ever grew -- steadily widening the window in which a real message is
 *    invisible. Mailpit has a search API; both helpers now use it, so the size
 *    of the mailbox stops mattering.
 *
 * 2. The polling window was 45s (15 x 3s). Under `fullyParallel` that is not
 *    long enough: see `withRegistrationSlot` below for why the sends bunch up.
 *    The window is now ~3 minutes with a backoff, which costs nothing when the
 *    mail arrives promptly.
 * ------------------------------------------------------------------ */

const MAILPIT = 'https://mailhog.staging.weeb.vip';

type MailpitMessage = {
  ID: string;
  Created: string;
  To?: { Address: string }[];
  Bcc?: { Address: string }[];
};

async function mailpitFetch(endpoint: string, init?: RequestInit, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${MAILPIT}${endpoint}`, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Every message addressed to `recipientEmail`, newest first.
 *
 * The `to:` search is done server-side so a busy mailbox can't hide a message,
 * and the result is then filtered again here: a search backend that ignored the
 * field prefix would otherwise hand back the whole mailbox and the caller would
 * happily verify somebody else's account.
 */
async function messagesFor(recipientEmail: string): Promise<MailpitMessage[]> {
  const response = await mailpitFetch(
    `/api/v1/search?query=${encodeURIComponent(`to:${recipientEmail}`)}&limit=200`
  );
  if (!response.ok) throw new Error(`Mailpit search failed: HTTP ${response.status}`);
  const data = await response.json();
  const messages: MailpitMessage[] = data.messages || [];

  return messages
    .filter((msg) => {
      const addresses = [...(msg.To || []), ...(msg.Bcc || [])].map((t) => t.Address);
      return addresses.some((addr) => addr === recipientEmail || addr === `<${recipientEmail}>`);
    })
    .sort((a, b) => Date.parse(b.Created) - Date.parse(a.Created));
}

/**
 * Delete emails for a recipient from Mailpit (staging email server)
 */
export async function deleteEmailsForRecipient(recipientEmail: string) {
  try {
    const ids = (await messagesFor(recipientEmail)).map((msg) => msg.ID);
    if (ids.length === 0) return;

    await mailpitFetch('/api/v1/messages', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ IDs: ids })
    });
    console.log(`Cleaned up ${ids.length} emails for ${recipientEmail}`);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('Email cleanup timed out, continuing...');
    } else {
      console.log('Could not delete emails:', error);
    }
  }
}

/**
 * The newest message for an address, with its body, waiting for it to arrive.
 *
 * Backs off from 2s to 5s over about three minutes. The long tail is there
 * because the send, not the delivery, is what runs late under load -- and the
 * callers' own `test.setTimeout` values allow for the whole of it, so that a
 * mail that never comes is reported as a mail that never came rather than as a
 * bare test timeout with nothing pointing at the cause.
 */
export async function getLatestEmail(recipientEmail: string, retries = 40, delay = 2000) {
  console.log(`Looking for email for ${recipientEmail}...`);
  const started = Date.now();

  for (let i = 0; i < retries; i++) {
    try {
      const [newest] = await messagesFor(recipientEmail);
      if (newest) {
        console.log(
          `Found email for ${recipientEmail} after ${Math.round((Date.now() - started) / 1000)}s; fetching full message...`
        );
        const full = await mailpitFetch(`/api/v1/message/${newest.ID}`);
        return await full.json();
      }
      if (i === 0 || i % 5 === 0) {
        console.log(`Attempt ${i + 1}: no mail for ${recipientEmail} yet`);
      }
    } catch (error) {
      console.log(`Attempt ${i + 1} failed:`, error instanceof Error ? error.message : String(error));
    }

    // 2s early on so a prompt send is not made to wait, easing off to 5s so a
    // slow one is still caught without hammering the API for three minutes.
    await new Promise((resolve) => setTimeout(resolve, Math.min(delay + i * 250, 5000)));
  }

  throw new Error(
    `No email found for ${recipientEmail} after ${retries} attempts (${Math.round((Date.now() - started) / 1000)}s)`
  );
}

/* ------------------------------------------------------------------ *
 * Registration throttle
 *
 * Eight spec files register accounts. Each is already `describe.serial`, which
 * orders the tests *within* a file and does nothing at all between files -- and
 * with `fullyParallel` and a worker per core, the suite opens by firing every
 * one of those registrations at shared staging within the same second. The
 * accounts are created (the redirect to /auth/check-email happens), but for the
 * addresses in the middle of the burst no verification mail is ever sent: they
 * return zero hits in Mailpit long after the run, so no amount of polling on
 * this side would have found them. Run any of those files on its own and it
 * passes.
 *
 * `describe.serial` can't express "one at a time across files", per-project
 * `workers` doesn't exist, and putting the mail specs in their own project
 * would take them out of `--project=chromium` -- which is the command the suite
 * is actually run with. So the constraint is enforced where it belongs, around
 * the submit itself: a lock directory (mkdir is atomic, and works across worker
 * processes) admits one registration at a time and holds the slot briefly after
 * it, spacing the sends out. Everything else in these specs still runs in
 * parallel; only the moment of hitting the registration endpoint is queued.
 * ------------------------------------------------------------------ */

const REGISTRATION_LOCK = path.join(os.tmpdir(), 'weeb-e2e-registration.lock');

/** Left between one registration and the next, so sends never bunch up. */
const REGISTRATION_GAP_MS = 2500;

/** A slot older than this belongs to a worker that died holding it. */
const SLOT_STALE_MS = 180000;

/** Longest a spec will queue before giving up and going ahead anyway. */
const SLOT_WAIT_MS = 420000;

async function acquireRegistrationSlot(): Promise<void> {
  const startedWaiting = Date.now();

  while (Date.now() - startedWaiting < SLOT_WAIT_MS) {
    try {
      await fs.mkdir(REGISTRATION_LOCK);
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;

      try {
        const heldFor = Date.now() - (await fs.stat(REGISTRATION_LOCK)).mtimeMs;
        if (heldFor > SLOT_STALE_MS) {
          console.log('Breaking a stale registration slot');
          await fs.rm(REGISTRATION_LOCK, { recursive: true, force: true });
        }
      } catch {
        // Another worker got there first; just go round again.
      }

      // Jittered, so the queue doesn't resolve into a thundering herd of its own.
      await new Promise((resolve) => setTimeout(resolve, 150 + Math.random() * 250));
    }
  }

  // Never fail a test over the queue itself -- the throttle is an optimisation,
  // not a behaviour under test.
  console.log('Waited too long for a registration slot; proceeding unthrottled');
}

/**
 * Run `submit` as the only registration in flight across the whole run.
 *
 * Wrap the *submit*, not the whole flow: waiting for the verification mail can
 * take a minute or more and holding the slot through that would serialise the
 * suite for no benefit -- it is the send that has to be spaced out, not the
 * wait.
 */
export async function withRegistrationSlot<T>(submit: () => Promise<T>): Promise<T> {
  await acquireRegistrationSlot();
  try {
    return await submit();
  } finally {
    await new Promise((resolve) => setTimeout(resolve, REGISTRATION_GAP_MS));
    await fs.rm(REGISTRATION_LOCK, { recursive: true, force: true }).catch(() => {});
  }
}

export function extractVerificationLink(emailContent: string, baseUrl: string): string | null {
  let decodedContent = emailContent
    .replace(/=\r?\n/g, '')
    .replace(/=3D/g, '=')
    .replace(/=20/g, ' ')
    .replace(/=2F/g, '/')
    .replace(/=3A/g, ':')
    .replace(/=40/g, '@');

  const linkPattern = /<a[^>]+href\s*=\s*(?:3D)?\\?["']([^"']*verification\?email=[^"']*)/gi;
  const match = linkPattern.exec(decodedContent);

  if (match && match[1]) {
    let link = match[1];
    link = link.replace(/&amp;/g, '&');
    link = link.replace(/&#x3D;/g, '=');
    link = link.replace(/\\/g, '');

    if (!link.startsWith('http')) {
      link = `${baseUrl}${link.startsWith('/') ? '' : '/'}${link}`;
    } else {
      const url = new URL(link);
      const testUrl = new URL(baseUrl);
      url.protocol = testUrl.protocol;
      url.host = testUrl.host;
      url.port = testUrl.port;
      link = url.toString();
    }

    console.log(`Found verification link in email: ${link}`);
    return link;
  }

  const directUrlPattern = /https?:\/\/[^\/\s]+\/auth\/verification\?email=[^&\s]+&token=[^&\s"]+/gi;
  const directMatch = directUrlPattern.exec(decodedContent);
  if (directMatch) {
    let link = directMatch[0];
    link = link.replace(/&amp;/g, '&');

    const url = new URL(link);
    const testUrl = new URL(baseUrl);
    url.protocol = testUrl.protocol;
    url.host = testUrl.host;
    url.port = testUrl.port;
    link = url.toString();

    console.log(`Found verification link (direct pattern): ${link}`);
    return link;
  }

  return null;
}


/**
 * Register a new account from /auth/register and wait for the redirect to the
 * "check your email" screen, which is now how a successful signup confirms
 * itself (it used to be an inline alert under the emptied form).
 *
 * The staging registration endpoint is intermittently slow under parallel-shard
 * load, so the submit is retried once if the redirect doesn't happen — this is
 * the single most common source of e2e flake. The retry re-checks the URL
 * first, so a slow-but-successful redirect is never double-submitted.
 */
export async function registerNewUser(page: Page, email: string, password: string) {
  await page.goto('/auth/register', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await waitForAuthForm(page);
  await page.locator('form').waitFor({ state: 'visible', timeout: 15000 });

  await page.locator('input[type="email"], input[name="username"]').first().fill(email);
  await page.locator('input[name="password"][type="password"]').first().fill(password);
  const confirm = page.locator('input[name="confirmPassword"]');
  if ((await confirm.count()) > 0) await confirm.fill(password);

  const submitButton = page.locator('form button[type="submit"]').first();
  await submitButton.waitFor({ state: 'visible' });
  // wait out the hydration gate before the first click
  await page.waitForFunction(
    () => {
      const btn = document.querySelector('form button[type="submit"]') as HTMLButtonElement | null;
      return !!btn && !btn.disabled;
    },
    { timeout: 15000 }
  );

  // One registration in flight across the whole run — see withRegistrationSlot.
  await withRegistrationSlot(async () => {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (page.url().includes('/auth/check-email')) break;
      try {
        // The button disables itself while the mutation is in flight. Waiting
        // for it to be actionable means a merely-slow first submit is never
        // retried against a disabled button, which otherwise hangs until the
        // test timeout.
        await expect(submitButton).toBeEnabled({ timeout: 30000 });
        await submitButton.click({ timeout: 10000 });
      } catch {
        // Either we navigated away (button detached) or it never settled — the
        // URL check below decides which.
      }
      try {
        await page.waitForURL(/\/auth\/check-email/, { timeout: 25000 });
        break;
      } catch {
        if (attempt === 0) {
          // eslint-disable-next-line no-console
          console.log('Registration redirect did not happen, retrying submit...');
        }
      }
    }
  });

  await expect(page).toHaveURL(/\/auth\/check-email/, { timeout: 20000 });
  await expect(page.getByRole('heading', { name: /check your email/i })).toBeVisible({ timeout: 15000 });
  // The address must be on screen — that's the whole point of the screen.
  await expect(page.getByText(email, { exact: false }).first()).toBeVisible({ timeout: 10000 });
}

/**
 * Force a PostHog feature flag on for the rest of the page's life.
 *
 * Specs that exercise a flagged section have to pin the flag, or they pass or
 * fail on rollout state rather than on the code under test. PostHog is not
 * initialised in local dev (no key), so `window.posthog` is undefined and every
 * flag reads false; patching what exists therefore has nothing to attach to.
 * This installs a stub when absent and re-patches if the real SDK loads later
 * and replaces the method.
 *
 * Two details here are load-bearing, and both were learned from a bug:
 *
 * 1. The stub MUST be an array. PostHog's loader snippet puts an array on
 *    `window.posthog` and pushes every queued call onto it until the real SDK
 *    arrives. A plain object makes that `posthog.push(...)` throw during
 *    hydration, and an exception mid-flush takes Svelte's effect graph down
 *    with it: the page renders once and then never updates again. That is not
 *    a visible crash -- it looks like a component that is simply broken, and
 *    it cost a real debugging session in anime-news.spec.ts, where a section
 *    marker appeared permanently stuck while the page underneath was fine.
 *
 * 2. The patched marker goes on the FUNCTION, not on `window.posthog`. The
 *    real SDK replaces the method on the same object when it loads, so a flag
 *    on the object would make the re-patch a no-op and silently lose the
 *    override.
 */
export async function forceFeatureFlag(page: Page, flag: string) {
  await page.addInitScript((FLAG: string) => {
    const install = () => {
      const w = window as any;
      if (!w.posthog) w.posthog = [];
      const posthog = w.posthog;
      if (posthog.isFeatureEnabled?.__flagPatched) return;
      const original =
        typeof posthog.isFeatureEnabled === 'function'
          ? posthog.isFeatureEnabled.bind(posthog)
          : () => false;
      const patched = (key: string) => (key === FLAG ? true : original(key));
      patched.__flagPatched = true;
      posthog.isFeatureEnabled = patched;
    };
    install();
    // The real SDK can land well after the first paint and bring its own
    // method with it, so keep re-patching for a while rather than once.
    const iv = setInterval(install, 25);
    setTimeout(() => clearInterval(iv), 10000);
  }, flag);
}
