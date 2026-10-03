<script lang="ts">
  import Seo from '$lib/Seo.svelte';
  import Button from '$lib/components/primitives/Button';
  import EmptyState from '$lib/components/primitives/EmptyState';
  import PosterGrid from '$lib/components/primitives/PosterGrid';
  import PosterCardSkeleton from '$lib/components/cards/PosterCardSkeleton';
  import { ActivityFeed, FEED_PAGE_SIZE } from '$lib/components/feed';
  import { loginModalStore } from '$lib/stores/auth';
  import { FeedPageBloc } from './FeedPage.bloc.svelte';

  /**
   * The feed: list activity from the people you follow, newest first.
   */
  let {
    data,
    bloc = new FeedPageBloc({ source: () => ({ ssr: data.ssr ?? null }), pageSize: FEED_PAGE_SIZE }),
  }: {
    data: { ssr?: any; auth?: any };
    bloc?: FeedPageBloc;
  } = $props();
</script>

<Seo title="Feed" description="What the people you follow are watching and reading." noIndex={true} />

<div class="feed-page">
  <div class="feed-header">
    <h1 class="feed-title">Feed</h1>
    <p class="feed-subtitle">What the people you follow are watching and reading.</p>
  </div>

  {#if !bloc.isLoggedIn}
    <EmptyState
      variant="panel"
      heading="Sign in to see your feed"
      message="Follow people from their profile pages and their list activity shows up here."
    >
      <Button onClick={() => loginModalStore.requireAuth({ reason: 'Sign in to see your feed' })}>Sign in</Button>
    </EmptyState>
  {:else if bloc.isLoading}
    <PosterGrid>
      {#each Array(8) as _}
        <PosterCardSkeleton />
      {/each}
    </PosterGrid>
  {:else if bloc.isError}
    <EmptyState variant="panel" heading="Could not load your feed" message="Try again in a moment." />
  {:else if bloc.isEmpty}
    <EmptyState
      variant="panel"
      heading="Your feed is quiet"
      message="Follow a few people and their list activity will show up here."
    >
      <Button href="/search" color="transparent">Find people to follow</Button>
    </EmptyState>
  {:else}
    <ActivityFeed items={bloc.items} />

    {#if bloc.totalPages > 1}
      <nav class="feed-pager" aria-label="Feed pages">
        <Button size="sm" color="transparent" disabled={!bloc.hasPrevious} onClick={() => bloc.previous()}>Newer</Button>
        <span class="feed-pager-status">Page {bloc.page} of {bloc.totalPages}</span>
        <Button size="sm" color="transparent" disabled={!bloc.hasNext} onClick={() => bloc.next()}>Older</Button>
      </nav>
    {/if}
  {/if}
</div>

<style>
  .feed-page {
    max-width: 1180px;
    margin: 0 auto;
    padding: 1.5rem 1rem 4rem;
  }
  .feed-header {
    margin-bottom: 1.5rem;
  }
  .feed-title {
    font-size: clamp(1.4rem, 3vw, 1.9rem);
    font-weight: 700;
    color: var(--weeb-fg);
    margin: 0;
  }
  .feed-subtitle {
    margin: 0.25rem 0 0;
    color: var(--weeb-fg-muted);
  }
  .feed-pager {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    margin-top: 2rem;
  }
  .feed-pager-status {
    font-family: var(--weeb-font-mono, ui-monospace, monospace);
    font-size: 0.8rem;
    color: var(--weeb-fg-muted);
  }
</style>
