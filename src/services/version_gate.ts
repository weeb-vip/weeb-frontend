export function versionGate(searchClient?: any) {
  try {
    const KEY = 'app_version';
    const current = (__APP_VERSION__ as string) || 'dev';
    const previous = localStorage.getItem(KEY);

    if (previous && previous !== current) {
      // Clear Algolia caches (v4)
      searchClient?.clearCache?.(); // available in newer clients
      searchClient?.transporter?.requestsCache?.clear?.();
      searchClient?.transporter?.responsesCache?.clear?.();
      searchClient?.transporter?.hostsCache?.clear?.();
    }

    localStorage.setItem(KEY, current);
  } catch {
    /* no-op */
  }
}
