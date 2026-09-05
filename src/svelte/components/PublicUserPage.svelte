<script lang="ts">
  import PosterCard from './PosterCard.svelte';
  import PosterGrid from './PosterGrid.svelte';
  import EmptyState from './EmptyState.svelte';
  import ProfileAvatar from './ProfileAvatar.svelte';
  import { PublicUserPageBloc, type PublicUserCard } from './PublicUserPage.bloc.svelte';

  /**
   * Someone else's profile.
   *
   * A view over the bloc: it resolves the accent, the CDN URLs and the counts;
   * this renders the header and the two shelves under it.
   */
  let {
    user,
    lists = null,
    bloc = new PublicUserPageBloc({ source: () => ({ user, lists }) }),
  }: {
    user: any;
    lists?: any;
    bloc?: PublicUserPageBloc;
  } = $props();
</script>

{#snippet shelf(cards: PublicUserCard[], empty: string)}
  {#if cards.length > 0}
    <PosterGrid>
      {#each cards as card (card.key)}
        <PosterCard {...card} />
      {/each}
    </PosterGrid>
  {:else}
    <EmptyState size="compact" message={empty} />
  {/if}
{/snippet}

<div class="public-page" style={bloc.accentStyle}>
  <!-- Header -->
  <header class="hero">
    <div class="hero-banner" class:hero-banner--empty={!bloc.bannerUrl}>
      {#if bloc.bannerUrl}
        <img class="hero-banner-img" src={bloc.bannerUrl} alt={`${bloc.displayName}'s banner`} />
      {/if}
      <div class="hero-banner-scrim"></div>
    </div>

    <div class="hero-body">
      <div class="hero-avatar-wrap">
        <ProfileAvatar
          size="xl"
          linkToProfile={false}
          src={bloc.avatarUrl}
          alt={bloc.displayName}
          initials={bloc.initials}
        />
      </div>

      <div class="hero-identity">
        <h1 class="hero-name">{bloc.displayName}</h1>
        <p class="hero-handle">@{bloc.username}</p>
        {#if bloc.bio}
          <p class="hero-bio">{bloc.bio}</p>
        {/if}
      </div>

      {#if bloc.stats.length > 0}
        <dl class="hero-stats">
          {#each bloc.stats as stat (stat.label)}
            <div class="hero-stat">
              <dt class="hero-stat-label">{stat.label}</dt>
              <dd class="hero-stat-value">{stat.value}</dd>
            </div>
          {/each}
        </dl>
      {/if}
    </div>
  </header>

  <!-- Lists -->
  <div class="container">
    {#if !bloc.isPublic}
      <EmptyState
        class="private-note"
        variant="panel"
        size="compact"
        icon={lockIcon}
        heading="These lists are private"
        message={`${bloc.displayName} hasn't made their anime and manga public.`}
      />
    {:else}
      <section class="section">
        <div class="section-header">
          <div class="section-header-left">
            <svg width="18" height="18" fill="none" stroke="var(--weeb-accent)" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="7" width="20" height="15" rx="2"/><path d="M17 2l-5 5-5-5"/></svg>
            <h2 class="section-title">Currently Watching</h2>
            {#if bloc.watching.length > 0}
              <span class="section-count">{bloc.watching.length}</span>
            {/if}
          </div>
        </div>

        {@render shelf(bloc.watching, 'Not watching anything right now.')}
      </section>

      <section class="section">
        <div class="section-header">
          <div class="section-header-left">
            <svg width="18" height="18" fill="none" stroke="var(--weeb-accent)" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
            <h2 class="section-title">Currently Reading</h2>
            {#if bloc.reading.length > 0}
              <span class="section-count">{bloc.reading.length}</span>
            {/if}
          </div>
        </div>

        {@render shelf(bloc.reading, 'Not reading anything right now.')}
      </section>
    {/if}
  </div>
</div>

{#snippet lockIcon()}
  <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
{/snippet}

<style>
  .public-page {
    padding: 0 0 4rem;
  }

  /* The lists below the header keep a readable centered column; the header
     itself spans the full viewport width. */
  .container {
    max-width: 1180px;
    margin: 0 auto;
    padding: 0 1rem;
  }

  /* Header ---------------------------------------------------------------- */
  .hero {
    position: relative;
    overflow: hidden;
    background: var(--weeb-surface);
    border-bottom: 1px solid var(--weeb-border);
  }

  .hero-banner {
    position: relative;
    height: clamp(140px, 26vw, 260px);
    background: linear-gradient(120deg, color-mix(in oklch, var(--weeb-accent) 40%, transparent), transparent 70%);
  }
  .hero-banner--empty {
    background:
      radial-gradient(120% 140% at 15% 0%, color-mix(in oklch, var(--weeb-accent) 32%, transparent), transparent 60%),
      linear-gradient(180deg, color-mix(in oklch, var(--weeb-fg) 4%, transparent), transparent);
  }
  .hero-banner-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .hero-banner-scrim {
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, transparent 40%, color-mix(in oklch, var(--weeb-bg) 88%, transparent));
  }

  .hero-body {
    position: relative;
    max-width: 1180px;
    margin: -44px auto 0;
    display: grid;
    grid-template-columns: auto 1fr;
    grid-template-areas:
      'avatar identity'
      'stats  stats';
    gap: 0.5rem 1.25rem;
    padding: 0 1.5rem 1.75rem;
  }

  /* The wrapper carries the size; the shared hero avatar fills it. */
  .hero-avatar-wrap {
    grid-area: avatar;
    width: 108px;
    height: 108px;
    --hero-avatar-initials: 2.2rem;
  }

  .hero-identity {
    grid-area: identity;
    align-self: end;
    padding-bottom: 0.25rem;
    min-width: 0;
  }
  .hero-name {
    font-size: clamp(1.4rem, 3vw, 1.9rem);
    font-weight: 700;
    line-height: 1.1;
    color: var(--weeb-fg);
    margin: 0;
  }
  .hero-handle {
    font-family: var(--weeb-font-mono, ui-monospace, monospace);
    font-size: 0.85rem;
    color: var(--weeb-accent);
    margin: 0.15rem 0 0;
  }
  .hero-bio {
    margin: 0.6rem 0 0;
    max-width: 60ch;
    font-size: 0.95rem;
    line-height: 1.5;
    color: var(--weeb-fg-muted);
    white-space: pre-line;
  }

  .hero-stats {
    grid-area: stats;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin: 1.1rem 0 0;
  }
  .hero-stat {
    display: flex;
    flex-direction: column-reverse;
    align-items: flex-start;
    gap: 0.1rem;
    padding: 0.5rem 0.85rem;
    border-radius: 10px;
    background: var(--weeb-surface);
    border: 1px solid var(--weeb-border);
    min-width: 84px;
  }
  .hero-stat-label {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--weeb-fg-muted);
  }
  .hero-stat-value {
    font-family: var(--weeb-font-mono, ui-monospace, monospace);
    font-size: 1.35rem;
    font-weight: 600;
    line-height: 1;
    margin: 0;
    color: var(--weeb-fg);
  }

  /* Lists ----------------------------------------------------------------- */
  .section {
    margin-top: 2.5rem;
  }
  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
  }
  .section-header-left {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }
  .section-title {
    font-size: 1.15rem;
    font-weight: 700;
    color: var(--weeb-fg);
    margin: 0;
  }
  .section-count {
    font-family: var(--weeb-font-mono, ui-monospace, monospace);
    font-size: 0.8rem;
    font-weight: 600;
    padding: 0.1rem 0.5rem;
    border-radius: 999px;
    color: var(--weeb-accent);
    background: color-mix(in oklch, var(--weeb-accent) 16%, transparent);
  }

  :global(.private-note) { margin-top: 2.5rem; }

  @media (max-width: 640px) {
    .hero-body {
      grid-template-columns: 1fr;
      grid-template-areas:
        'avatar'
        'identity'
        'stats';
      justify-items: start;
      margin-top: -40px;
    }
    .hero-avatar-wrap {
      width: 88px;
      height: 88px;
    }
  }
</style>
