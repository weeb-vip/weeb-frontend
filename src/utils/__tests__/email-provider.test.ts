import { emailProviderFor } from '../email-provider';

describe('emailProviderFor', () => {
  it('resolves known providers to a labelled webmail link', () => {
    expect(emailProviderFor('james@gmail.com')).toEqual({
      label: 'Open Gmail',
      url: expect.stringContaining('mail.google.com'),
    });
    expect(emailProviderFor('james@outlook.com').label).toBe('Open Outlook');
    expect(emailProviderFor('james@proton.me').label).toBe('Open Proton Mail');
    expect(emailProviderFor('james@icloud.com').label).toBe('Open iCloud Mail');
  });

  it('treats provider aliases as the same provider', () => {
    expect(emailProviderFor('a@hotmail.com').url).toBe(emailProviderFor('b@live.com').url);
    expect(emailProviderFor('a@me.com').url).toBe(emailProviderFor('b@icloud.com').url);
  });

  it('is case- and whitespace-insensitive on the domain', () => {
    expect(emailProviderFor('James@GMAIL.com').label).toBe('Open Gmail');
    expect(emailProviderFor('james@gmail.com ').label).toBe('Open Gmail');
  });

  it('splits on the last @ so plus-addressing and quoted locals still resolve', () => {
    expect(emailProviderFor('james+anime@gmail.com').label).toBe('Open Gmail');
    expect(emailProviderFor('"odd@local"@gmail.com').label).toBe('Open Gmail');
  });

  // A wrong deep link is worse than none — unknown domains get a label with no
  // URL, and the UI falls back to a plain "go to log in" action.
  it('falls back to a generic label with no link for unknown domains', () => {
    expect(emailProviderFor('james@jamesat.dev')).toEqual({
      label: 'Open your email app',
      url: null,
    });
    expect(emailProviderFor('someone@self-hosted.internal').url).toBeNull();
  });

  it('falls back for missing, empty or malformed addresses', () => {
    expect(emailProviderFor(null).url).toBeNull();
    expect(emailProviderFor(undefined).url).toBeNull();
    expect(emailProviderFor('').url).toBeNull();
    expect(emailProviderFor('not-an-email').url).toBeNull();
    expect(emailProviderFor('trailing@').url).toBeNull();
  });
});
