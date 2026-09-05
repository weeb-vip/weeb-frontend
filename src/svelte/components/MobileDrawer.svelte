<script lang="ts">
  import { untrack } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import ProfileAvatar from './ProfileAvatar.svelte';
  import { MobileDrawerBloc } from './MobileDrawer.bloc.svelte';

  let { bloc: injected = undefined }: { bloc?: MobileDrawerBloc } = $props();

  // Init body, not a prop default: the real bloc builds the user query, and
  // the QueryClient only exists in Svelte context during initialisation.
  const bloc = untrack(() => injected) ?? new MobileDrawerBloc();

  const version = __APP_VERSION__;

  // The page behind a modal surface must not scroll with it. The bloc owns
  // the pin; this is the subscription that drives it, and the teardown that
  // guarantees the body is released even if the drawer is destroyed open.
  $effect(() => {
    bloc.isOpen;
    bloc.syncBodyScroll();

    return () => bloc.releaseBodyScroll();
  });

  // Focus was never moved into the panel, so a keyboard user tabbed through
  // the page behind an open drawer and Escape dropped them at the top of the
  // document. This puts focus on the close button, keeps Tab inside the panel,
  // and hands focus back to whatever opened it -- the hamburger.
  function trapFocus(node: HTMLElement) {
    const opener = document.activeElement as HTMLElement | null;
    const SELECTOR =
      'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

    const focusable = () =>
      [...node.querySelectorAll<HTMLElement>(SELECTOR)].filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );

    (node.querySelector<HTMLElement>('.drawer-close') ?? node).focus();

    function onKeydown(event: KeyboardEvent) {
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    node.addEventListener('keydown', onKeydown);

    return {
      destroy() {
        node.removeEventListener('keydown', onKeydown);
        // Only if the opener is still in the document; a logout navigates away.
        if (opener?.isConnected) opener.focus();
      },
    };
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      bloc.close();
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      bloc.handleEscape();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if bloc.isOpen}
  <!-- Backdrop is purely presentational; click-to-dismiss has keyboard
       equivalents via the Escape handler and the close button. -->
  <div
    class="drawer-backdrop"
    onclick={handleBackdropClick}
    role="presentation"
    transition:fade={{ duration: 200, easing: cubicOut }}
  >
    <!-- A dialog, and announced as one. Without the role and label a screen
         reader got no indication anything had opened; tabindex makes the panel
         itself a focus fallback when it holds no focusable child. -->
    <div
      class="drawer-panel"
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      tabindex="-1"
      use:trapFocus
      transition:fly={{ x: '100%', duration: 280, easing: cubicOut, opacity: 1 }}
    >
      <!-- Header -->
      <div class="drawer-header">
        <a href="/" onclick={() => bloc.close()} class="drawer-logo">
          <img
            src="https://cdn.weeb.vip/images/logo6-rev-sm_sm.png"
            alt="weeb.vip"
            width="32"
            height="32"
            loading="eager"
            class="drawer-logo-img"
          />
          <span class="drawer-logo-text">weeb.vip</span>
        </a>
        <button class="drawer-close" onclick={() => bloc.close()} aria-label="Close menu">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- User card (if logged in) -->
      <!-- The only way to the profile from this drawer. The Account list below
           used to carry a "My Profile" row as well, pointing at the same page
           one row further down.

           Gated on isLoggedIn rather than on the user query having resolved,
           because the Account list is gated that way too: requiring a resolved
           user here while listing account links there meant a slow or failed
           user query left the drawer with no route to the profile at all. -->
      {#if bloc.isLoggedIn}
        <a href="/profile" onclick={() => bloc.close()} class="drawer-user-card">
          <ProfileAvatar
            username={bloc.user?.username ?? ''}
            profileImageUrl={bloc.user?.profileImageUrl}
            size="md"
            linkToProfile={false}
          />
          <div class="drawer-user-info">
            <span class="drawer-user-name">{bloc.displayName}</span>
            {#if bloc.fullName}
              <span class="drawer-user-sub">{bloc.fullName}</span>
            {/if}
          </div>
          <svg class="drawer-user-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </a>
      {/if}

      <!-- Navigation -->
      <nav class="drawer-nav" aria-label="Primary">
        {#each bloc.navLinks as link (link.href)}
          {@const active = bloc.isActive(link.href)}
          <a
            href={link.href}
            onclick={() => bloc.close()}
            class="drawer-nav-item"
            class:active
            aria-current={active ? 'page' : undefined}
          >
            <svg class="drawer-nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d={link.icon} />
            </svg>
            <span>{link.label}</span>
          </a>
        {/each}
      </nav>

      <!-- Account section (if logged in) -->
      {#if bloc.isLoggedIn}
        <div class="drawer-nav">
          <div class="drawer-nav-label">Account</div>
          {#each bloc.userLinks as link (link.href)}
            {@const active = bloc.isActive(link.href)}
            <a
              href={link.href}
              onclick={() => bloc.close()}
              class="drawer-nav-item"
              class:active
              aria-current={active ? 'page' : undefined}
            >
              <svg class="drawer-nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d={link.icon} />
              </svg>
              <span>{link.label}</span>
            </a>
          {/each}
        </div>
      {/if}

      <!-- Sign in sits directly under the navigation rather than at the foot of
           the panel. It is the primary action for a signed-out visitor, and the
           flex spacer below used to strand it past a quarter-panel of empty
           space where nothing drew the eye toward it. -->
      {#if !bloc.isLoggedIn}
        <div class="drawer-auth">
          <button class="drawer-btn-primary" onclick={() => bloc.requestLogin()}>
            Login
          </button>
          <button class="drawer-btn-ghost" onclick={() => bloc.requestRegister()}>
            Register
          </button>
        </div>
      {/if}

      <!-- Preferences -->
      <div class="drawer-settings">
        <div class="drawer-nav-label">Preferences</div>
        <div class="drawer-setting-row">
          <span>Title Language</span>
          <button
            class="drawer-lang-toggle"
            onclick={() => bloc.toggleTitleLanguage()}
            aria-label="Toggle title language"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
            </svg>
            <span>{bloc.languageLabel}</span>
          </button>
        </div>
      </div>

      <!-- Spacer -->
      <div class="drawer-spacer"></div>

      <!-- Sign out (if logged in) -->
      {#if bloc.isLoggedIn}
        <div class="drawer-logout-section">
          <button class="drawer-logout-btn" onclick={() => bloc.signOut()} disabled={bloc.isSigningOut}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>{bloc.isSigningOut ? 'Signing out…' : 'Sign Out'}</span>
          </button>
        </div>
      {/if}

      <!-- Footer -->
      <div class="drawer-footer">
        <span>{version}</span>
      </div>
    </div>
  </div>
{/if}

<style>
  .drawer-backdrop {
    position: fixed;
    inset: 0;
    z-index: 200;
    background: oklch(0% 0 0 / 0.6);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
  }

  .drawer-panel {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    max-width: 320px;
    background: var(--weeb-bg-elevated);
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    /* Without this, scrolling past the end of the drawer chains to the page
       behind it. */
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
    padding: env(safe-area-inset-top, 0px) 0 env(safe-area-inset-bottom, 0px);
  }

  /* Header */
  .drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--weeb-border);
    flex-shrink: 0;
  }
  .drawer-logo {
    display: flex;
    align-items: center;
    gap: 10px;
    text-decoration: none;
    color: var(--weeb-fg);
  }
  .drawer-logo-img {
    width: 32px;
    height: 32px;
    border-radius: 50%;
  }
  .drawer-logo-text {
    font-weight: 700;
    font-size: 20px;
    letter-spacing: -0.02em;
  }
  /* 44x44 is the iOS minimum and this is the most-tapped control in a panel
     that only ever renders on touch. The icon inside stays 20px. */
  .drawer-close {
    width: 44px;
    height: 44px;
    margin-right: -8px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--weeb-radius);
    color: var(--weeb-fg-muted);
    transition: background 0.15s, color 0.15s;
  }
  .drawer-close:hover {
    background: var(--weeb-surface);
    color: var(--weeb-fg);
  }

  /* User card */
  .drawer-user-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 20px;
    border-bottom: 1px solid var(--weeb-border);
    text-decoration: none;
    color: var(--weeb-fg);
    transition: background 0.15s;
  }
  .drawer-user-card:hover, .drawer-user-card:active {
    background: var(--weeb-surface);
  }
  .drawer-user-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .drawer-user-name {
    font-size: 15px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .drawer-user-sub {
    font-size: 13px;
    color: var(--weeb-fg-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .drawer-user-chevron {
    flex-shrink: 0;
    color: var(--weeb-fg-muted);
  }

  /* Navigation */
  .drawer-nav {
    padding: 12px 0;
  }
  .drawer-nav-label {
    padding: 8px 20px;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--weeb-fg-muted);
  }
  .drawer-nav-item {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 12px 20px;
    font-size: 15px;
    font-weight: 500;
    color: var(--weeb-fg-secondary);
    text-decoration: none;
    transition: background 0.15s, color 0.15s;
  }
  .drawer-nav-item:hover, .drawer-nav-item:active {
    background: var(--weeb-surface);
    color: var(--weeb-fg);
  }
  /* The same accent the desktop header uses for aria-current, so the current
     page is marked identically whichever nav you opened. Weight carries it as
     well as colour: a list item distinguished only by hue is unreadable to
     anyone who cannot separate the two. */
  .drawer-nav-item.active {
    color: var(--weeb-accent-text);
    font-weight: 600;
  }
  .drawer-nav-item.active .drawer-nav-icon {
    color: var(--weeb-accent-text);
  }
  .drawer-nav-icon {
    flex-shrink: 0;
    color: var(--weeb-fg-muted);
  }
  .drawer-nav-item:hover .drawer-nav-icon,
  .drawer-nav-item:active .drawer-nav-icon {
    color: var(--weeb-accent-text);
  }

  /* Settings */
  .drawer-settings {
    padding: 4px 0 12px;
    border-top: 1px solid var(--weeb-border);
  }
  .drawer-setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 2px 20px;
    font-size: 15px;
    font-weight: 500;
    color: var(--weeb-fg-secondary);
  }
  .drawer-lang-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    /* Padded to the 44px touch minimum without growing the chip's visual
       weight: the row it sits in keeps its height because the label beside it
       is centred against the same box. */
    min-height: 44px;
    padding: 6px 14px;
    border-radius: var(--weeb-radius);
    background: var(--weeb-surface);
    color: var(--weeb-fg-secondary);
    font-size: 13px;
    font-weight: 600;
    transition: background 0.15s, color 0.15s;
  }
  .drawer-lang-toggle:hover {
    background: var(--weeb-surface-hover);
    color: var(--weeb-fg);
  }

  /* Spacer */
  .drawer-spacer {
    flex: 1;
  }

  /* Auth buttons */
  .drawer-auth {
    padding: 16px 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    border-top: 1px solid var(--weeb-border);
  }
  .drawer-btn-primary {
    width: 100%;
    padding: 12px;
    border-radius: var(--weeb-radius);
    background: var(--weeb-accent);
    color: white;
    font-size: 15px;
    font-weight: 600;
    text-align: center;
    transition: background 0.15s;
  }
  .drawer-btn-primary:hover {
    background: var(--weeb-accent-hover);
  }
  .drawer-btn-ghost {
    width: 100%;
    padding: 12px;
    border-radius: var(--weeb-radius);
    background: transparent;
    border: 1px solid var(--weeb-border);
    color: var(--weeb-fg-secondary);
    font-size: 15px;
    font-weight: 600;
    text-align: center;
    transition: background 0.15s, color 0.15s;
  }
  .drawer-btn-ghost:hover {
    background: var(--weeb-surface);
    color: var(--weeb-fg);
  }

  /* Logout */
  .drawer-logout-section {
    padding: 8px 20px 16px;
    border-top: 1px solid var(--weeb-border);
  }
  /* Reads as an ordinary row until touched. Red on rest made the destructive
     action the most salient element in the panel, outranking the accent. */
  .drawer-logout-btn {
    display: flex;
    align-items: center;
    gap: 14px;
    width: 100%;
    min-height: 44px;
    padding: 12px 0;
    font-size: 15px;
    font-weight: 500;
    color: var(--weeb-fg-secondary);
    transition: color 0.15s;
  }
  .drawer-logout-btn:hover, .drawer-logout-btn:active, .drawer-logout-btn:focus-visible {
    color: var(--weeb-red);
  }

  /* Footer */
  .drawer-footer {
    padding: 12px 20px;
    text-align: center;
    font-size: 12px;
    font-family: var(--weeb-font-mono);
    color: var(--weeb-fg-muted);
    border-top: 1px solid var(--weeb-border);
    flex-shrink: 0;
  }
</style>
