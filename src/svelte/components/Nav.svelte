<script lang="ts">
  export let currentPath: string = '/';
  export let logoSrc: string = 'https://cdn.weeb.vip/images/logo6-rev-sm_sm.png';
  export let seasonUrl: string = '#';

  const links = [
    { href: '/', label: 'Home' },
    { href: seasonUrl, label: 'Season' },
    { href: '/airing', label: 'Airing' },
    { href: '/search', label: 'Browse' },
  ];
</script>

<nav class="nav">
  <a href="/" class="nav-logo">
    <img src={logoSrc} alt="weeb.vip" width="32" height="32" class="nav-logo-img" />
    <span class="nav-logo-text">weeb.vip</span>
  </a>

  <div class="nav-links">
    {#each links as link}
      <a href={link.href} class:active={currentPath === link.href}>{link.label}</a>
    {/each}
  </div>

  <div class="nav-search">
    <span class="nav-search-icon">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
    </span>
    <input type="text" placeholder="Search anime..." />
  </div>

  <div class="nav-auth">
    <button class="btn-ghost">Log in</button>
    <button class="btn-primary">Sign up</button>
  </div>
</nav>

<style>
  .nav {
    position: sticky;
    top: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 0 24px;
    height: var(--weeb-nav-height, 60px);
    background: var(--weeb-glass-bg);
    backdrop-filter: var(--weeb-glass-blur);
    -webkit-backdrop-filter: var(--weeb-glass-blur);
    border-bottom: 1px solid var(--weeb-border);
  }

  .nav-logo {
    display: flex;
    align-items: center;
    gap: 8px;
    text-decoration: none;
    color: var(--weeb-fg);
    font-weight: 700;
    font-size: 18px;
    letter-spacing: -0.02em;
    flex-shrink: 0;
  }
  .nav-logo-img {
    width: 32px;
    height: 32px;
    border-radius: 50%;
  }
  .nav-logo-text {
    display: none;
  }

  .nav-links {
    display: none;
    gap: 4px;
    margin-left: 24px;
  }
  .nav-links a {
    padding: 6px 14px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    color: var(--weeb-fg-secondary);
    text-decoration: none;
    transition: color 0.15s, background 0.15s;
  }
  .nav-links a:hover,
  .nav-links a.active {
    color: var(--weeb-fg);
    background: var(--weeb-surface);
  }

  .nav-search {
    margin-left: auto;
    position: relative;
    flex: 1;
    max-width: 320px;
    min-width: 0;
  }
  .nav-search input {
    width: 100%;
    padding: 8px 12px 8px 36px;
    background: var(--weeb-surface);
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius);
    color: var(--weeb-fg);
    font-size: 14px;
    font-family: inherit;
    outline: none;
    transition: border-color 0.15s;
  }
  .nav-search input:focus {
    border-color: var(--weeb-accent);
  }
  .nav-search input::placeholder {
    color: var(--weeb-fg-muted);
  }
  .nav-search-icon {
    position: absolute;
    left: 10px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--weeb-fg-muted);
    font-size: 14px;
    pointer-events: none;
    display: flex;
  }

  .nav-auth {
    display: none;
    gap: 8px;
    margin-left: 16px;
    flex-shrink: 0;
  }
  .btn-ghost {
    padding: 7px 16px;
    border-radius: var(--weeb-radius);
    font-size: 13px;
    font-weight: 500;
    color: var(--weeb-fg-secondary);
    background: transparent;
    border: none;
    cursor: pointer;
    font-family: inherit;
    transition: color 0.15s, background 0.15s;
  }
  .btn-ghost:hover {
    color: var(--weeb-fg);
    background: var(--weeb-surface);
  }
  .btn-primary {
    padding: 7px 18px;
    border-radius: var(--weeb-radius);
    font-size: 13px;
    font-weight: 600;
    background: var(--weeb-accent);
    color: white;
    border: none;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
  }
  .btn-primary:hover {
    background: var(--weeb-accent-hover);
  }

  /* Desktop: show nav links, logo text, auth */
  @media (min-width: 1024px) {
    .nav-logo-text { display: inline; }
    .nav-links { display: flex; }
    .nav-auth { display: flex; }
  }

  @media (max-width: 480px) {
    .nav { padding: 0 16px; }
  }
</style>
