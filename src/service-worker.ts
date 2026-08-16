/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />

// PWA service worker.
//
// This replaces a hand-rolled worker that used to live at public/sw.js and
// broke the site after every deploy. That one is now a tombstone that
// unregisters itself; see the comments in public/sw.js for the history.
//
// SvelteKit builds this file and registers it automatically, and it is adapter
// aware, so the same source works for both the knative/node build and the
// Cloudflare Pages build. $service-worker gives us the exact asset list for
// this build rather than a hand-maintained one:
//
//   build   - the app's own JS/CSS, content hashed
//   files   - everything in the static assets dir (public/)
//   version - kit.version.name, which svelte.config.js already pins to the
//             release version
//
// The three things the old worker got wrong, and how this avoids them:
//
//  1. Its cache name was a fixed constant, so the activate cleanup never
//     matched and caches survived deploys. Here the cache name embeds version,
//     so each release gets a fresh cache and every older one is deleted.
//
//  2. It served anything with a dot in the path cache-first, which caught JS
//     chunks from previous builds. Here only the known ASSETS for this exact
//     build are served from cache, and those URLs are content hashed.
//
//  3. It cached navigations and fell back to a stale precached '/'. This does
//     not intercept navigations at all, so HTML always comes from the network
//     and SSR is never served from a previous release.

import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

// Unique per release, so a deploy cannot reuse the previous build's entries.
const CACHE = `weebvip-${version}`;

// Only what this build actually produced.
const ASSETS = new Set([...build, ...files]);

// Deliberately no precaching on install.
//
// Eagerly caching everything in ASSETS meant 164 URLs and 6.2 MiB fetched in a
// burst the moment the worker installed - including a 3.2 MiB logo most
// visitors never load - and that happens again on every release, for every
// user, on whatever connection they are on. The fetch handler below populates
// the cache from traffic that actually happens instead, which is enough to
// make repeat loads fast without the thundering herd.
// Note there is deliberately no skipWaiting() or clients.claim() here.
//
// Seizing control of already-loaded pages mid-session routes their in-flight
// asset requests through a worker with a cold cache, and that measurably
// destabilised the e2e suite: chromium went from 53 passed / 0 failed to one
// and then three failures, in different tests each run. A new worker instead
// takes over on the next navigation, which is the standard lifecycle.
//
// Waiting costs nothing here. Assets are content hashed and the cache is keyed
// by release, so an older worker still in control only ever serves URLs from
// its own build - which the newer HTML no longer asks for. There is no stale
// asset window to close by rushing.
sw.addEventListener('install', () => {
  // Intentionally empty: nothing is precached, so there is no install work.
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Delete every other cache, including the legacy weebvip-v1 /
      // weebvip-api-v1 / weebvip-images-v1 entries left by the old worker.
      for (const key of await caches.keys()) {
        if (key !== CACHE) await caches.delete(key);
      }
    })()
  );
});

sw.addEventListener('fetch', (event) => {
  const { request } = event;

  // Never interfere with anything that mutates state.
  if (request.method !== 'GET') return;

  // Navigations are deliberately not handled: HTML is server rendered and must
  // always come from the network, otherwise a deploy serves last release's
  // markup pointing at asset hashes that no longer exist.
  if (request.mode === 'navigate') return;

  const url = new URL(request.url);

  // Cross-origin is left alone entirely - the GraphQL gateway, Algolia and the
  // OTLP collector must not be cached or intercepted, and caching an opaque
  // cross-origin response would silently poison later reads.
  if (url.origin !== sw.location.origin) return;

  // Only assets this build declared. Their URLs are content hashed, so
  // cache-first is safe: a new build produces new URLs and therefore misses.
  if (!ASSETS.has(url.pathname)) return;

  event.respondWith(
    (async () => {
      // caches.match is the optimised global lookup; opening the cache on every
      // request just to read from it adds avoidable work to the worker thread,
      // which sits in front of every asset the page loads.
      const cached = await caches.match(url.pathname, { cacheName: CACHE });
      if (cached) return cached;

      const cache = await caches.open(CACHE);

      // First time this asset is requested for this release: serve from the
      // network and backfill the cache. Never store a non-OK response, or a
      // failed deploy would be cached as though it were the app.
      const response = await fetch(request);
      if (response.ok) {
        // Not awaited so the response is not held up by the write, and errors
        // are swallowed: a full or unavailable cache must never turn a request
        // that already succeeded into a failure.
        cache.put(url.pathname, response.clone()).catch(() => {});
      }
      return response;
    })()
  );
});
