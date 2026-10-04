import { describe, it, expect } from 'vitest';
import { shieldFromRocketLoader } from './rocket-loader';

describe('shieldFromRocketLoader', () => {
  it('marks the SvelteKit init script so Rocket Loader leaves it alone', () => {
    const html = '<body><div id="app"></div>\n\t\t\t<script>\n\t\t\t\t{\n\t\t\t\t\t__sveltekit_aby4va = {\n\t\t\t\t\t\tbase: ""\n\t\t\t\t\t};\n\t\t\t\t}\n\t\t\t</script></body>';
    const out = shieldFromRocketLoader(html);
    expect(out).toContain('<script data-cfasync="false">\n\t\t\t\t{\n\t\t\t\t\t__sveltekit_aby4va');
    expect(out.match(/<script data-cfasync="false">/g)).toHaveLength(1);
  });

  it('leaves every other script alone', () => {
    const html = '<script type="application/ld+json">{}</script><script type="module" src="/x.js"></script><script>console.log(1)</script>';
    expect(shieldFromRocketLoader(html)).toBe(html);
  });

  it('is a no-op on a chunk without the init script', () => {
    expect(shieldFromRocketLoader('<head><title>x</title></head>')).toBe('<head><title>x</title></head>');
  });
});
