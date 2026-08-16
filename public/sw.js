// Tombstone service worker.
//
// This file used to be a caching service worker. Its registration was removed
// in 6bced4f (the Astro -> Svelte migration), but removing the registration
// call does not unregister anything: a service worker keeps running in every
// browser that ever installed it, forever, until it explicitly unregisters
// itself. So visitors from before that commit are still being served by the
// old worker.
//
// That worker was actively harmful after a deploy:
//
//   - it served /assets/ and anything with a dot in the path cache-first,
//     with no expiry, so it handed back JS chunks from an old build
//   - its cache names were fixed constants ('weebvip-v1'), so the activate
//     handler's cleanup never matched anything and caches were never
//     invalidated between releases
//   - navigation failures fell back to a copy of '/' precached at install
//     time, which referenced asset hashes that no longer exist
//
// The visible symptom was a broken or 500-ing page after a Cloudflare Pages
// deploy that came right only after a hard refresh, because a hard refresh is
// exactly the thing that bypasses the service worker.
//
// This replacement deliberately registers no fetch handler, so it intercepts
// nothing even before it manages to remove itself. Browsers re-check the
// worker script on navigation, and because these bytes differ from the old
// ones the update installs and this runs.
//
// Do not delete this file. Serving a 404 for /sw.js does not reliably remove
// an installed worker, and the tombstone needs to stay reachable long enough
// for infrequent visitors to pick it up.

self.addEventListener('install', () => {
  // Take over without waiting for existing tabs to close.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Drop every cache, not just the known names — the old worker's
      // constants may have drifted across versions.
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map((key) => caches.delete(key)));

      await self.registration.unregister();

      // Reload anything currently under this worker's control so it leaves
      // immediately with fresh assets, rather than on some later visit.
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        client.navigate(client.url);
      }
    })()
  );
});
