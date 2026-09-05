<script lang="ts" module>
  import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
  import type { Snippet } from 'svelte';

  /**
   * The one call to action an empty state is allowed. Either a link (`href`)
   * or a button (`onClick`) -- the call sites split evenly between the two:
   * ProfilePage and the profile lists send you somewhere ("Explore Anime"),
   * SeasonPage and CurrentlyAiringPage undo a filter in place.
   */
  export interface EmptyStateAction {
    label: string;
    href?: string;
    onClick?: () => void;
    /** `primary` is the filled accent CTA; `ghost` the outlined undo-a-filter one. */
    variant?: 'primary' | 'ghost';
  }

  export type EmptyStateVariant = 'plain' | 'panel';
  export type EmptyStateSize = 'compact' | 'default' | 'hero';
  export type EmptyStateIconFrame = 'none' | 'circle';
</script>

<script lang="ts">
  import Fa from 'svelte-fa';

  /**
   * The "there is nothing here" surface. One shape for all thirteen of them:
   * an optional icon, a heading, a line of body copy, an optional second line,
   * and at most one call to action.
   *
   * Presentational -- no bloc. The condition that decides an empty state is
   * showing belongs to whatever owns the data.
   */
  let {
    icon,
    iconFrame = 'none',
    heading = '',
    headingTag = 'h3',
    message = '',
    detail = '',
    action,
    variant = 'plain',
    size = 'default',
    children,
    class: className = '',
  }: {
    /** A FontAwesome icon, or a snippet for the inline SVGs the pages already use. */
    icon?: IconDefinition | Snippet;
    /** `circle` puts the icon in the 64px surface disc the profile lists use. */
    iconFrame?: EmptyStateIconFrame;
    heading?: string;
    /**
     * Some call sites sit inside a section that already has an `h2`; others
     * are the only thing on screen. The caller picks the level that keeps the
     * document outline honest.
     */
    headingTag?: 'h2' | 'h3' | 'h4' | 'p';
    message?: string;
    detail?: string;
    action?: EmptyStateAction;
    /** `panel` draws the bordered elevated card ProfilePage uses. */
    variant?: EmptyStateVariant;
    size?: EmptyStateSize;
    /** Body content richer than `message` -- e.g. copy with a link inside it. */
    children?: Snippet;
    class?: string;
  } = $props();

  /** A snippet is a function; an IconDefinition is a plain object. */
  const iconSnippet = $derived(typeof icon === 'function' ? (icon as Snippet) : undefined);
  const faIcon = $derived(typeof icon === 'function' ? undefined : (icon as IconDefinition | undefined));
</script>

<div class="es es--{variant} es--{size} {className}">
  {#if icon}
    <div class="es-icon" class:es-icon--circle={iconFrame === 'circle'} aria-hidden="true">
      {#if iconSnippet}
        {@render iconSnippet()}
      {:else if faIcon}
        <Fa icon={faIcon} />
      {/if}
    </div>
  {/if}

  {#if heading}
    <svelte:element this={headingTag} class="es-heading">{heading}</svelte:element>
  {/if}

  {#if message}
    <p class="es-message">{message}</p>
  {/if}

  {#if detail}
    <p class="es-detail">{detail}</p>
  {/if}

  {#if children}
    <div class="es-body">{@render children()}</div>
  {/if}

  {#if action}
    {#if action.href}
      <a class="es-action es-action--{action.variant ?? 'primary'}" href={action.href}>
        {action.label}
      </a>
    {:else}
      <button
        type="button"
        class="es-action es-action--{action.variant ?? 'primary'}"
        onclick={action.onClick}
      >
        {action.label}
      </button>
    {/if}
  {/if}
</div>

<style>
  .es {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    /* Every call site that sits in a poster grid needs the full row; harmless
       everywhere else. */
    grid-column: 1 / -1;
  }

  .es--compact { padding: 32px 16px; }
  .es--default { padding: 64px 24px; }
  .es--hero { padding: 80px 24px; }

  .es--panel {
    background: var(--weeb-bg-elevated, var(--weeb-surface));
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius-lg, 12px);
  }
  .es--panel.es--default { padding: 40px 24px; }
  .es--panel.es--hero { padding: 64px 24px; }

  .es-icon {
    color: var(--weeb-fg-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 16px;
    /* Muted rather than full strength: the icon is orientation, the copy is
       the message. */
    opacity: 0.6;
    font-size: 28px;
  }
  .es-icon--circle {
    width: 64px;
    height: 64px;
    border-radius: var(--weeb-radius-full, 9999px);
    background: var(--weeb-surface);
    opacity: 1;
  }

  .es-heading {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--weeb-fg);
    margin: 0 0 8px;
  }
  .es--hero .es-heading { font-size: 1.25rem; }

  .es-message {
    font-size: 0.875rem;
    color: var(--weeb-fg-muted);
    max-width: 360px;
    margin: 0;
    line-height: 1.5;
  }
  .es-detail {
    font-size: 0.8rem;
    color: var(--weeb-fg-muted);
    max-width: 360px;
    margin: 8px 0 0;
    line-height: 1.5;
  }
  .es-body {
    font-size: 0.875rem;
    color: var(--weeb-fg-muted);
    max-width: 360px;
    margin-top: 8px;
    line-height: 1.5;
  }

  .es-action {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 20px;
    height: 36px;
    padding: 0 20px;
    border-radius: var(--weeb-radius, 8px);
    font-family: inherit;
    font-size: 0.85rem;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
  }
  .es-action--primary {
    background: var(--weeb-accent);
    border: 1px solid transparent;
    color: #fff;
  }
  .es-action--primary:hover { background: var(--weeb-accent-hover); }

  .es-action--ghost {
    background: none;
    border: 1px solid var(--weeb-border);
    color: var(--weeb-accent-text);
  }
  .es-action--ghost:hover { border-color: var(--weeb-accent); }

  .es-action:focus-visible {
    outline: 2px solid var(--weeb-accent);
    outline-offset: 2px;
  }
</style>
