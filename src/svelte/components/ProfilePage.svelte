<script lang="ts">
  import PosterCard from './PosterCard.svelte';
  import PosterGrid from './PosterGrid.svelte';
  import ProfileImageUpload from './ProfileImageUpload.svelte';
  import ProfileAvatar from './ProfileAvatar.svelte';
  import EmptyState from './EmptyState.svelte';
  import Skeleton from './Skeleton.svelte';
  import PosterCardSkeleton from './PosterCardSkeleton.svelte';
  import { ProfilePageBloc, type ProfileShelfCard } from './ProfilePage.bloc.svelte';

  /**
   * The dashboard at /profile: who you are, what your library adds up to, and
   * the three shelves built out of it.
   *
   * A view over the bloc -- it owns the six queries, the airing cross-reference
   * and the two upload modals; this renders what they come to.
   */
  let {
    /** Prefetched on the server by +page.server.ts. */
    ssr = null,
    bloc = new ProfilePageBloc({ source: () => ({ ssr }) }),
  }: {
    ssr?: any;
    bloc?: ProfilePageBloc;
  } = $props();

  $effect(() => {
    void bloc.init();
  });
</script>

<!-- PosterCardSkeleton, matching the PosterCards that load in below.
     AnimeCardSkeleton draws the other card -- a fixed 192x288 box with the
     metadata column beside the art -- so in these grid cells the placeholder
     was neither the cell's width nor the loaded card's shape. -->
{#snippet shelfSkeleton(count: number)}
  <PosterGrid>
    {#each Array(count) as _}
      <PosterCardSkeleton />
    {/each}
  </PosterGrid>
{/snippet}

{#snippet shelf(cards: ProfileShelfCard[])}
  <PosterGrid>
    {#each cards as card (card.key)}
      <PosterCard {...card} />
    {/each}
  </PosterGrid>
{/snippet}

<!-- Profile Banner -->
<div class="profile-banner">
  {#if bloc.bannerUrl}
    <img
      class="profile-banner-img"
      src={bloc.bannerUrl}
      alt=""
      onerror={() => bloc.bannerFailed()}
    />
  {/if}
  <button
    type="button"
    class="profile-banner-edit"
    onclick={() => bloc.openBanner()}
    aria-label="Change banner image"
  >
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>
    </svg>
    <span>Change banner</span>
  </button>
</div>

<!-- Profile Header (overlaps banner) -->
<header class="profile-header">
  <div class="profile-header-inner">
    {#if bloc.isUserLoading}
      <div class="profile-avatar-wrap">
        <Skeleton className="w-full h-full rounded-full" />
      </div>
      <div class="profile-info">
        <Skeleton className="h-6 w-2/5 mb-2" />
        <Skeleton className="h-3.5 w-3/5" />
      </div>
    {:else if bloc.user}
      <div class="profile-avatar-wrap">
        <ProfileAvatar
          size="xl"
          linkToProfile={false}
          src={bloc.avatarUrl}
          alt={bloc.username}
          initials={bloc.username.charAt(0).toUpperCase()}
        />
        <button
          onclick={() => bloc.openUpload()}
          class="profile-avatar-overlay"
          aria-label="Change profile picture"
        >
          <span>Change</span>
        </button>
      </div>
      <div class="profile-info">
        <h1 class="profile-name">{bloc.username}</h1>
        <div class="profile-meta">
          {#if bloc.fullName}
            <span>{bloc.fullName}</span>
            <span class="profile-meta-dot"></span>
          {/if}
          <span>Member</span>
        </div>
      </div>
      <div class="profile-actions">
        <a href="/settings" class="btn-settings">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          Settings
        </a>
      </div>
    {/if}
  </div>
</header>

<!-- Stats Strip -->
<div class="stats-strip">
  {#each bloc.stats as stat (stat.label)}
    <a href={stat.href} class="stat-cell" class:stat-cell--active={stat.active}>
      <div class="stat-number" style={stat.color ? `color:${stat.color}` : ''}>{stat.value}</div>
      <div class="stat-label">
        {#if stat.dotColor}
          <span class="stat-dot" style="background:{stat.dotColor}"></span>
        {/if}
        {stat.label}
      </div>
    </a>
  {/each}
</div>

<!-- Content Sections -->
<div class="profile-content">
  <!-- Currently Watching -->
  <section class="profile-section">
    <div class="section-header">
      <div class="section-header-left">
        <svg width="18" height="18" fill="none" stroke="var(--weeb-accent)" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        <h2 class="section-title">Currently Watching</h2>
        {#if !bloc.isShelvesLoading && bloc.currentlyWatching.length > 0}
          <span class="section-count section-count--accent">{bloc.currentlyWatching.length}</span>
        {/if}
      </div>
      {#if !bloc.isShelvesLoading && bloc.currentlyWatching.length > 0}
        <a href="/profile/anime" class="section-link">View All</a>
      {/if}
    </div>

    {#if bloc.isShelvesLoading}
      {@render shelfSkeleton(6)}
    {:else if bloc.currentlyWatching.length > 0}
      {@render shelf(bloc.currentlyWatching)}
    {:else}
      <EmptyState
        variant="panel"
        icon={watchingIcon}
        message="You're not currently watching any anime"
        detail="Start watching something new from your plan to watch list"
      />
    {/if}
  </section>

  <!-- Currently Reading -->
  {#if bloc.hasReading}
    <section class="profile-section">
      <div class="section-header">
        <div class="section-header-left">
          <svg width="18" height="18" fill="none" stroke="var(--weeb-purple, var(--weeb-accent))" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          <h2 class="section-title">Currently Reading</h2>
          <span class="section-count section-count--accent">{bloc.readingTotal}</span>
        </div>
        <a href="/profile/anime?medium=manga" class="section-link">View All</a>
      </div>

      {@render shelf(bloc.readingCards)}
    </section>
  {/if}

  <!-- Nothing on any shelf -->
  {#if bloc.isLibraryEmpty}
    <EmptyState
      class="profile-hero-empty"
      variant="panel"
      size="hero"
      icon={bookmarkIcon}
      heading="Your watchlist is empty"
      message="Start adding anime to your watchlist to see personalized recommendations and airing schedules."
      action={{ label: 'Explore Anime', href: '/' }}
    />
  {/if}

  <!-- Airing This Week -->
  <section class="profile-section">
    <div class="section-header">
      <div class="section-header-left">
        <svg width="18" height="18" fill="none" stroke="var(--weeb-red)" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
        <h2 class="section-title">Airing This Week</h2>
        {#if !bloc.isShelvesLoading && bloc.airingSoon.length > 0}
          <span class="section-count section-count--red">{bloc.airingSoon.length}</span>
        {/if}
      </div>
    </div>

    {#if bloc.isShelvesLoading}
      {@render shelfSkeleton(3)}
    {:else if bloc.airingSoon.length > 0}
      {@render shelf(bloc.airingSoon)}
    {:else}
      <EmptyState
        variant="panel"
        icon={calendarIcon}
        message="No episodes airing this week from your watchlist"
        detail="Check back later or add more anime to your watchlist"
      />
    {/if}
  </section>

  <!-- Recently Aired Episodes -->
  <section class="profile-section">
    <div class="section-header">
      <div class="section-header-left">
        <svg width="18" height="18" fill="none" stroke="var(--weeb-green)" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
        <h2 class="section-title">Recently Aired Episodes</h2>
        {#if !bloc.isShelvesLoading && bloc.recentlyAired.length > 0}
          <span class="section-count section-count--green">{bloc.recentlyAired.length}</span>
        {/if}
      </div>
    </div>

    {#if bloc.isShelvesLoading}
      {@render shelfSkeleton(3)}
    {:else if bloc.recentlyAired.length > 0}
      {@render shelf(bloc.recentlyAired)}
    {:else}
      <EmptyState
        variant="panel"
        icon={clockIcon}
        message="No recent episodes from your watchlist"
        detail="Episodes you've watched will appear here"
      />
    {/if}
  </section>
</div>

<ProfileImageUpload
  isOpen={bloc.isUploadOpen}
  queryClient={bloc.queryClient}
  onClose={() => bloc.closeUpload()}
/>

<ProfileImageUpload
  variant="banner"
  isOpen={bloc.isBannerOpen}
  queryClient={bloc.queryClient}
  onClose={() => bloc.closeBanner()}
/>

{#snippet watchingIcon()}
  <svg width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="7" width="20" height="15" rx="2"/><path d="M17 2l-5 5-5-5"/></svg>
{/snippet}

{#snippet bookmarkIcon()}
  <svg width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>
{/snippet}

{#snippet calendarIcon()}
  <svg width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M15 14l-6 6M9 14l6 6"/></svg>
{/snippet}

{#snippet clockIcon()}
  <svg width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l-3 3"/></svg>
{/snippet}

<style>
  /* ── Profile Banner ────────────────────────────────────────── */
  .profile-banner {
    position: relative;
    height: 200px;
    background: linear-gradient(135deg,
      color-mix(in oklch, var(--weeb-surface) 80%, var(--weeb-accent)) 0%,
      color-mix(in oklch, var(--weeb-bg-elevated) 70%, var(--weeb-violet, var(--weeb-accent-hover))) 50%,
      color-mix(in oklch, var(--weeb-bg) 80%, var(--weeb-accent)) 100%
    );
    overflow: hidden;
  }

  /* The uploaded banner covers the gradient when there is one; the gradient
     stays as the ground behind it and the fallback when there is not. */
  .profile-banner-img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .profile-banner-edit {
    position: absolute;
    top: 12px;
    right: 12px;
    z-index: 2;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--weeb-fg);
    background: color-mix(in oklch, var(--weeb-bg) 55%, transparent);
    backdrop-filter: blur(8px);
    border: 1px solid var(--weeb-border);
    border-radius: 999px;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.15s ease, background 0.15s ease;
  }
  .profile-banner:hover .profile-banner-edit,
  .profile-banner-edit:focus-visible {
    opacity: 1;
  }
  .profile-banner-edit:hover:not(:disabled) {
    background: color-mix(in oklch, var(--weeb-bg) 70%, transparent);
  }
  .profile-banner::before {
    content: '';
    position: absolute; inset: 0;
    background-image:
      linear-gradient(color-mix(in oklch, var(--weeb-fg) 3%, transparent) 1px, transparent 1px),
      linear-gradient(90deg, color-mix(in oklch, var(--weeb-fg) 3%, transparent) 1px, transparent 1px);
    background-size: 60px 60px;
    z-index: 0;
  }
  .profile-banner::after {
    content: '';
    position: absolute; inset: 0;
    background: linear-gradient(to bottom, transparent 40%, var(--weeb-bg) 100%);
    z-index: 1;
  }

  /* ── Profile Header (overlaps banner) ──────────────────────── */
  .profile-header {
    position: relative;
    margin-top: -64px;
    padding: 0 var(--weeb-section-px, 48px);
    z-index: 2;
  }
  .profile-header-inner {
    display: flex;
    align-items: flex-end;
    gap: 24px;
  }

  /* The avatar's size lives here, on the wrapper, so the shared hero avatar can
     fill it and the breakpoints below have one thing to change. */
  .profile-avatar-wrap {
    position: relative;
    flex-shrink: 0;
    width: 120px;
    height: 120px;
  }
  .profile-avatar-overlay {
    position: absolute; inset: 0;
    border-radius: 50%;
    background: color-mix(in oklch, black 50%, transparent);
    opacity: 0; transition: opacity 0.2s;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; border: none;
    color: #fff;
  }
  .profile-avatar-wrap:hover .profile-avatar-overlay,
  .profile-avatar-overlay:focus-visible { opacity: 1; }

  /* Hover is not available on a touch screen, so on a coarse pointer the only
     way to change an avatar was invisible and undiscoverable. Show it there
     instead, dimmed enough that it reads as a control over the image rather
     than covering it. */
  @media (hover: none) {
    .profile-avatar-overlay {
      opacity: 1;
      background: color-mix(in oklch, black 35%, transparent);
    }
  }

  .profile-info {
    flex: 1; min-width: 0;
    padding-bottom: 4px;
  }
  .profile-name {
    font-size: 1.75rem; font-weight: 700;
    letter-spacing: -0.03em; line-height: 1.2;
    color: var(--weeb-fg);
    margin-bottom: 4px;
  }
  .profile-meta {
    font-size: 0.8rem; color: var(--weeb-fg-muted);
    display: flex; align-items: center; gap: 12px;
  }
  .profile-meta-dot {
    width: 3px; height: 3px; border-radius: 50%;
    background: var(--weeb-fg-muted);
  }

  .profile-actions {
    display: flex; gap: 8px; flex-shrink: 0;
    padding-bottom: 8px;
  }
  .btn-settings {
    height: 34px; padding: 0 16px;
    background: var(--weeb-surface); border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius, 8px); color: var(--weeb-fg-secondary);
    font-size: 0.8rem; font-weight: 500; cursor: pointer;
    display: flex; align-items: center; gap: 6px;
    transition: border-color 0.15s, color 0.15s;
    text-decoration: none;
    font-family: inherit;
  }
  .btn-settings:hover { border-color: var(--weeb-accent); color: var(--weeb-fg); }

  /* ── Stats strip ───────────────────────────────────────────── */
  .stats-strip {
    display: flex; gap: 0;
    margin: 24px var(--weeb-section-px, 48px) 0;
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius-lg, 12px);
    overflow: hidden;
  }
  .stat-cell {
    flex: 1;
    padding: 16px 12px;
    text-align: center;
    background: var(--weeb-surface);
    cursor: pointer;
    transition: background 0.15s;
    position: relative;
    text-decoration: none;
    color: inherit;
  }
  .stat-cell + .stat-cell { border-left: 1px solid var(--weeb-border); }
  .stat-cell:hover { background: var(--weeb-surface-hover); }
  .stat-cell--active {
    background: color-mix(in oklch, var(--weeb-accent) 8%, transparent);
  }
  .stat-cell--active::after {
    content: '';
    position: absolute; bottom: 0; left: 0; right: 0;
    height: 2px;
    background: var(--weeb-accent);
  }
  .stat-number {
    font-size: 1.5rem; font-weight: 700;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em; line-height: 1.2;
    color: var(--weeb-fg);
  }
  .stat-label {
    font-size: 0.7rem; color: var(--weeb-fg-muted);
    text-transform: uppercase; letter-spacing: 0.05em;
    font-weight: 500; margin-top: 2px;
  }
  .stat-dot {
    display: inline-block;
    width: 6px; height: 6px; border-radius: 50%;
    margin-right: 4px; vertical-align: middle;
  }

  /* ── Content area ─────────────────────────────────────────── */
  .profile-content {
    padding: 32px var(--weeb-section-px, 48px) 64px;
  }

  .profile-section { margin-bottom: 40px; }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
  }
  .section-header-left {
    display: flex; align-items: center; gap: 10px;
  }
  .section-title {
    font-size: 1.25rem; font-weight: 600;
    color: var(--weeb-fg); letter-spacing: -0.01em;
  }
  .section-count {
    font-size: 0.75rem; font-weight: 600;
    padding: 2px 8px; border-radius: 99px;
    font-variant-numeric: tabular-nums;
  }
  .section-count--accent {
    background: color-mix(in oklch, var(--weeb-accent) 15%, transparent);
    color: var(--weeb-accent-text);
  }
  .section-count--red {
    background: color-mix(in oklch, var(--weeb-red) 15%, transparent);
    color: var(--weeb-red);
  }
  .section-count--green {
    background: color-mix(in oklch, var(--weeb-green) 15%, transparent);
    color: var(--weeb-green);
  }
  .section-link {
    font-size: 0.85rem; font-weight: 500;
    color: var(--weeb-accent-text);
    text-decoration: none; transition: color 0.15s;
  }
  .section-link:hover { color: var(--weeb-accent-hover); }

  /* The one empty state that stands on its own rather than inside a section. */
  :global(.profile-hero-empty) { margin-bottom: 40px; }

  /* ── Responsive: 768px ─────────────────────────────────────── */
  @media (max-width: 768px) {
    .profile-banner { height: 140px; }
    .profile-header { margin-top: -48px; padding: 0 16px; }
    .profile-header-inner { gap: 16px; }
    .profile-avatar-wrap { width: 88px; height: 88px; --hero-avatar-initials: 2rem; }
    .profile-name { font-size: 1.35rem; }
    .profile-actions { display: none; }
    .stats-strip { margin: 16px 16px 0; }
    .stat-cell { padding: 12px 8px; }
    .stat-number { font-size: 1.1rem; }
    .stat-label { font-size: 0.6rem; }
    .profile-content { padding: 24px 16px 48px; }
    .profile-section { margin-bottom: 24px; }
  }

  /* ── Responsive: 480px ─────────────────────────────────────── */
  @media (max-width: 480px) {
    .profile-banner { height: 120px; }
    .profile-header { margin-top: -40px; }
    .profile-avatar-wrap { width: 72px; height: 72px; --hero-avatar-initials: 1.5rem; }
    .profile-name { font-size: 1.15rem; }
    .stats-strip { flex-wrap: wrap; }
    .stat-cell { flex: 1 1 33.33%; min-width: 0; }
    .stat-cell:nth-child(4),
    .stat-cell:nth-child(5),
    .stat-cell:nth-child(6) { border-top: 1px solid var(--weeb-border); }
  }
</style>
