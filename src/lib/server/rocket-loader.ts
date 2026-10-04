/**
 * Keep Cloudflare Rocket Loader off SvelteKit's bootstrap.
 *
 * Rocket Loader rewrites every classic `<script>` it finds to a private type
 * and runs them itself, late, from its own deferred loader. The `cf-rocket`
 * meta in app.html does not stop it (that meta is not a documented switch),
 * and production HTML showed the 56KB SvelteKit init script, the one that
 * carries the page data and starts hydration, rewritten to
 * `type="<hash>-text/javascript"`. Everything that waits on hydration then
 * waited on Rocket Loader too.
 *
 * `data-cfasync="false"` is the documented per-script opt-out. SvelteKit emits
 * its init script as a bare `<script>` followed by `__sveltekit_<id> = {`, so
 * that is the only tag touched; the theme script in app.html already carries
 * the attribute by hand.
 */
const SVELTEKIT_INIT = /<script>(\s*\{\s*__sveltekit_)/g;

export function shieldFromRocketLoader(html: string): string {
  return html.replace(SVELTEKIT_INIT, '<script data-cfasync="false">$1');
}
