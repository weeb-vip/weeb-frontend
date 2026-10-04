import { test as base, expect, type Page } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import {
  deleteEmailsForRecipient,
  extractVerificationLink,
  getLatestEmail,
  registerNewUser,
  waitForAuthForm,
} from './helpers';

/**
 * One registered, verified, signed-in account per worker.
 *
 * Five specs used to register their own user, wait for the verification mail,
 * open the link and log in through the form before doing anything they were
 * about -- thirty to ninety seconds each, serialised further by the
 * registration slot in helpers.ts. The account is the same for all of them:
 * a fresh user with an empty list. So it is made once per worker here, its
 * cookies and storage captured, and every test in a spec that imports this
 * `test` starts already signed in.
 *
 * Tests on one worker run one after another, so they can see each other's
 * list changes; a spec that needs a clean row resets it first (see
 * manga-tracking) or puts it back when it is done (profile-reading-list).
 * A spec that needs its own user -- the token-expiry test, the follow test
 * with two people -- keeps registering on its own.
 */
export interface Account {
  email: string;
  password: string;
  /** Path of the saved storage state; a new context from it is signed in. */
  storageState: string;
}

export const PASSWORD = 'Password1!';

/** Register, verify through the mail, and sign in -- the flow the specs shared. */
export async function signUpAndIn(page: Page, email: string, password: string): Promise<void> {
  await registerNewUser(page, email, password);

  const baseUrl = page.url().match(/^https?:\/\/[^/]+/)![0];
  const mail = await getLatestEmail(email);
  const link = extractVerificationLink(mail.HTML || mail.Text || '', baseUrl);
  expect(link).toBeTruthy();
  await page.goto(link!, { waitUntil: 'domcontentloaded', timeout: 60000 });
  // Opening the link starts the request; leaving before it lands keeps the
  // account unverified, and that shows up later as a login that never redirects.
  await expect(
    page.getByRole('heading', { name: /you're verified|this link didn't work/i })
  ).toBeVisible({ timeout: 30000 });

  // The verification screen bounces to login on a timer; navigating there
  // explicitly avoids filling a form that is being replaced. Two attempts:
  // with several workers signing in at the same moment, staging has answered
  // a login so slowly that the first form submit was lost.
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.goto('/auth/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForAuthForm(page);
    await page.fill('input[name="username"]', email);
    await page.fill('input[name="password"]', password);
    const submit = page.locator('form:not([role="search"]) button[type="submit"]').first();
    await expect(submit).toBeEnabled({ timeout: 15000 });
    await submit.click();
    // Poll rather than waitForURL: staging's login is slow enough under load
    // that a single navigation predicate misses it.
    const left = await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 60000, intervals: [1000] })
      .not.toContain('/auth/login')
      .then(() => true, () => false);
    if (left) return;
    console.log(`Login did not redirect (attempt ${attempt + 1}); trying again`);
  }
  throw new Error(`Login for ${email} never left /auth/login`);
}

export const test = base.extend<{}, { account: Account }>({
  account: [
    async ({ browser }, use, workerInfo) => {
      const email = `${uuidv4()}@weeb.vip`;
      // A context made by hand carries none of the project's options, so the
      // base URL has to be handed over for the relative navigations below.
      const context = await browser.newContext({ baseURL: workerInfo.project.use.baseURL });
      const page = await context.newPage();
      await signUpAndIn(page, email, PASSWORD);
      // Under test-results, not the HTML report: the report is uploaded as a
      // CI artifact, and this file holds the account's cookies.
      const dir = path.join(workerInfo.config.rootDir, 'test-results', 'accounts');
      await fs.mkdir(dir, { recursive: true });
      const storageState = path.join(dir, `account-${workerInfo.project.name}-${workerInfo.parallelIndex}.json`);
      await context.storageState({ path: storageState });
      await context.close();

      await use({ email, password: PASSWORD, storageState });

      await deleteEmailsForRecipient(email).catch(() => {});
    },
    // Its own budget, not the first test's: registration, the mail wait and
    // two login attempts can add up to more than a test is allowed.
    { scope: 'worker', timeout: 300000 },
  ],
  // Every page in a spec that imports this `test` starts from the account's
  // cookies and storage, i.e. signed in.
  storageState: async ({ account }, use) => {
    await use(account.storageState);
  },
});

export { expect };
export type { Page };
