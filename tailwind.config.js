/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx,astro,svelte}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        weeb: {
          bg: 'var(--weeb-bg)',
          'bg-elevated': 'var(--weeb-bg-elevated)',
          surface: 'var(--weeb-surface)',
          'surface-hover': 'var(--weeb-surface-hover)',
          fg: 'var(--weeb-fg)',
          'fg-secondary': 'var(--weeb-fg-secondary)',
          'fg-muted': 'var(--weeb-fg-muted)',
          border: 'var(--weeb-border)',
          accent: 'var(--weeb-accent)',
          'accent-hover': 'var(--weeb-accent-hover)',
          /* --weeb-accent is a fill and measures 3.81:1 as text. This is the
             variant for text on it, and it needs a utility or every Tailwind
             call site has no choice but to use the fill. */
          'accent-text': 'var(--weeb-accent-text)',
          violet: 'var(--weeb-violet)',
          green: 'var(--weeb-green)',
          amber: 'var(--weeb-amber)',
          red: 'var(--weeb-red)',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'ui-monospace', 'Menlo', 'monospace'],
      },
      aspectRatio: {
        '2/3': '2 / 3',
      },
      animation: {
        marquee: 'marquee 5s linear infinite',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-100%)' },
        },
      },
    },
  },
  plugins: [],
}
