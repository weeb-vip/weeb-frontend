/**
 * Resolves an email address to a deep link into its webmail inbox, so the
 * "check your email" screen can offer a one-tap way back to the message
 * instead of leaving the user to find it themselves.
 *
 * Unknown domains (self-hosted, corporate, anything not listed) fall back to
 * a generic label with no link — a wrong guess is worse than no button.
 */

export interface EmailProvider {
  /** Button label, e.g. "Open Gmail" */
  label: string;
  /** Webmail URL, or null when the domain isn't recognised */
  url: string | null;
}

const GENERIC: EmailProvider = { label: 'Open your email app', url: null };

// Search URLs where the provider supports them, so the user lands on the
// verification email rather than an inbox they still have to scan.
const PROVIDERS: Record<string, EmailProvider> = {
  'gmail.com': { label: 'Open Gmail', url: 'https://mail.google.com/mail/u/0/#search/from%3Aweeb.vip' },
  'googlemail.com': { label: 'Open Gmail', url: 'https://mail.google.com/mail/u/0/#search/from%3Aweeb.vip' },
  'outlook.com': { label: 'Open Outlook', url: 'https://outlook.live.com/mail/0/inbox' },
  'hotmail.com': { label: 'Open Outlook', url: 'https://outlook.live.com/mail/0/inbox' },
  'live.com': { label: 'Open Outlook', url: 'https://outlook.live.com/mail/0/inbox' },
  'msn.com': { label: 'Open Outlook', url: 'https://outlook.live.com/mail/0/inbox' },
  'yahoo.com': { label: 'Open Yahoo Mail', url: 'https://mail.yahoo.com/d/search/keyword=weeb.vip' },
  'yahoo.co.uk': { label: 'Open Yahoo Mail', url: 'https://mail.yahoo.com/d/search/keyword=weeb.vip' },
  'ymail.com': { label: 'Open Yahoo Mail', url: 'https://mail.yahoo.com/d/search/keyword=weeb.vip' },
  'icloud.com': { label: 'Open iCloud Mail', url: 'https://www.icloud.com/mail' },
  'me.com': { label: 'Open iCloud Mail', url: 'https://www.icloud.com/mail' },
  'mac.com': { label: 'Open iCloud Mail', url: 'https://www.icloud.com/mail' },
  'proton.me': { label: 'Open Proton Mail', url: 'https://mail.proton.me/u/0/all-mail' },
  'protonmail.com': { label: 'Open Proton Mail', url: 'https://mail.proton.me/u/0/all-mail' },
  'pm.me': { label: 'Open Proton Mail', url: 'https://mail.proton.me/u/0/all-mail' },
  'fastmail.com': { label: 'Open Fastmail', url: 'https://app.fastmail.com/mail/Inbox' },
  'zoho.com': { label: 'Open Zoho Mail', url: 'https://mail.zoho.com/zm/#mail/folder/inbox' },
  'aol.com': { label: 'Open AOL Mail', url: 'https://mail.aol.com' },
  'gmx.com': { label: 'Open GMX', url: 'https://www.gmx.com/mail' },
  'gmx.net': { label: 'Open GMX', url: 'https://www.gmx.net/mail' },
  'mail.com': { label: 'Open Mail.com', url: 'https://www.mail.com/int/mail' },
  'yandex.com': { label: 'Open Yandex Mail', url: 'https://mail.yandex.com' },
  'yandex.ru': { label: 'Open Yandex Mail', url: 'https://mail.yandex.ru' },
};

export function emailProviderFor(address: string | null | undefined): EmailProvider {
  if (!address) return GENERIC;

  const at = address.lastIndexOf('@');
  if (at === -1) return GENERIC;

  const domain = address.slice(at + 1).trim().toLowerCase();
  if (!domain) return GENERIC;

  return PROVIDERS[domain] ?? GENERIC;
}
