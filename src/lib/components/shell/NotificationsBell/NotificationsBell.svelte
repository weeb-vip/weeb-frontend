<script lang="ts">
  import ProfileAvatar from '$lib/components/profile/ProfileAvatar';
  import { clickOutside } from '$lib/actions/clickOutside';
  import { NotificationsBellBloc } from './NotificationsBell.bloc.svelte';

  let { bloc = new NotificationsBellBloc() }: { bloc?: NotificationsBellBloc } = $props();
</script>

{#if bloc.isLoggedIn}
  <div
    class="bell"
    use:clickOutside={{ handler: () => bloc.close(), enabled: bloc.isOpen, event: 'mousedown' }}
  >
    <button
      type="button"
      class="bell-button"
      onclick={() => bloc.toggle()}
      aria-expanded={bloc.isOpen}
      aria-haspopup="true"
      aria-label={bloc.hasUnread ? `Notifications, ${bloc.unreadCount} unread` : 'Notifications'}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {#if bloc.hasUnread}
        <span class="bell-badge" data-testid="bell-badge">{bloc.badge}</span>
      {/if}
    </button>

    {#if bloc.isOpen}
      <div class="bell-panel weeb-floating absolute right-0 mt-2 w-80">
        <div class="bell-panel-head">
          <span class="bell-panel-title">Notifications</span>
          <button
            type="button"
            class="bell-mark"
            disabled={!bloc.hasUnread || bloc.isMarking}
            onclick={() => bloc.markAllRead()}
          >
            Mark all read
          </button>
        </div>

        {#if bloc.isListLoading}
          <p class="bell-empty">Loading…</p>
        {:else if bloc.items.length === 0}
          <p class="bell-empty">Nothing yet. When someone follows you, it shows up here.</p>
        {:else}
          <ul class="bell-list">
            {#each bloc.items as item (item.id)}
              <li>
                <a class="bell-item" class:bell-item--unread={item.isUnread} href={item.href} onclick={() => bloc.close()}>
                  {#if item.actor}
                    <ProfileAvatar
                      username={item.actor.username}
                      profileImageUrl={item.actor.profileImageUrl}
                      size="sm"
                      linkToProfile={false}
                    />
                  {/if}
                  <span class="bell-item-text">{item.text}</span>
                  <time class="bell-item-when" datetime={item.createdAt}>{item.when}</time>
                </a>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    {/if}
  </div>
{/if}

<style>
  .bell {
    position: relative;
  }
  .bell-button {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 999px;
    color: var(--weeb-fg-secondary);
    transition: background-color 0.2s, color 0.2s;
  }
  .bell-button:hover {
    background: var(--weeb-surface);
    color: var(--weeb-fg);
  }
  .bell-badge {
    position: absolute;
    top: 2px;
    right: 0;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    border-radius: 999px;
    background: var(--weeb-accent);
    color: #fff;
    font-family: var(--weeb-font-mono, ui-monospace, monospace);
    font-size: 0.65rem;
    font-weight: 700;
    line-height: 16px;
    text-align: center;
  }
  .bell-panel {
    z-index: var(--weeb-z-dropdown);
    padding: 0.5rem 0;
  }
  .bell-panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.35rem 1rem 0.6rem;
    border-bottom: 1px solid var(--weeb-border);
  }
  .bell-panel-title {
    font-weight: 600;
    color: var(--weeb-fg);
  }
  .bell-mark {
    font-size: 0.75rem;
    color: var(--weeb-accent-text, var(--weeb-accent));
  }
  .bell-mark:disabled {
    opacity: 0.5;
  }
  .bell-empty {
    margin: 0;
    padding: 1rem;
    font-size: 0.85rem;
    color: var(--weeb-fg-muted);
  }
  .bell-list {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 60vh;
    overflow-y: auto;
  }
  .bell-item {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.6rem 1rem;
    color: var(--weeb-fg-secondary);
    text-decoration: none;
    font-size: 0.85rem;
  }
  .bell-item:hover {
    background: var(--weeb-surface-hover);
  }
  .bell-item--unread {
    color: var(--weeb-fg);
    background: color-mix(in oklch, var(--weeb-accent) 8%, transparent);
  }
  .bell-item-text {
    flex: 1;
    min-width: 0;
  }
  .bell-item-when {
    font-family: var(--weeb-font-mono, ui-monospace, monospace);
    font-size: 0.7rem;
    color: var(--weeb-fg-muted);
  }
</style>
