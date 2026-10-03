<script lang="ts">
  import PosterCard from '$lib/components/cards/PosterCard';
  import PosterGrid from '$lib/components/primitives/PosterGrid';
  import ProfileAvatar from '$lib/components/profile/ProfileAvatar';
  import EmptyState from '$lib/components/primitives/EmptyState';
  import type { ActivityItem } from './activity';

  /**
   * A list of activities as poster cards, each with the line "who did what,
   * when" under it. Presentational: the page or section owning the rows maps
   * them with `toActivityItems` and decides what an empty list means.
   */
  let {
    items,
    empty = 'Nothing here yet.',
    showActor = true,
  }: {
    items: ActivityItem[];
    empty?: string;
    showActor?: boolean;
  } = $props();
</script>

{#if items.length === 0}
  <EmptyState size="compact" message={empty} />
{:else}
  <PosterGrid>
    {#each items as item (item.key)}
      <!-- The actor line sits beside the card, not inside it: PosterCard is
           one big link, and a link inside a link is not HTML. -->
      <div class="activity-item">
        <PosterCard {...item.card} />
        <p class="activity-line">
          {#if showActor}
            <a class="activity-actor" href={`/u/${encodeURIComponent(item.actor.username)}`}>
              <ProfileAvatar
                username={item.actor.username}
                profileImageUrl={item.actor.profileImageUrl}
                size="sm"
                linkToProfile={false}
                className="activity-avatar"
              />
              <span class="activity-name">{item.actor.name}</span>
            </a>
          {/if}
          <span class="activity-verb">{item.verb}</span>
          {#if item.when}
            <time class="activity-when" datetime={item.occurredAt}>{item.when}</time>
          {/if}
        </p>
      </div>
    {/each}
  </PosterGrid>
{/if}

<style>
  .activity-item {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .activity-line {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35rem;
    margin: 0.4rem 0 0;
    font-size: 0.78rem;
    line-height: 1.3;
    color: var(--weeb-fg-muted);
  }
  .activity-actor {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    color: var(--weeb-fg);
    font-weight: 600;
    text-decoration: none;
    min-width: 0;
  }
  .activity-actor:hover .activity-name {
    text-decoration: underline;
  }
  :global(.activity-avatar) {
    width: 18px;
    height: 18px;
  }
  .activity-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .activity-when {
    margin-left: auto;
    font-family: var(--weeb-font-mono, ui-monospace, monospace);
    font-size: 0.7rem;
  }
</style>
