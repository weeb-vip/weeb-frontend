<script lang="ts">
  import PosterCard from './PosterCard.svelte';
  import PosterGrid from './PosterGrid.svelte';
  import { configStore } from '../stores/config';
  import { workSubtitle } from '../../utils/workDisplay';

  export let user: any;
  export let lists: any = null;

  // The accent the user picked in their settings, resolved to the same OKLCH
  // value the swatch showed them. Applied as --weeb-accent over the page's
  // subtree, so their choice tints exactly the header and the counts and
  // nothing global.
  const ACCENT_MAP: Record<string, string> = {
    violet: 'oklch(55% 0.16 298)',
    blue: 'oklch(58% 0.15 250)',
    cyan: 'oklch(64% 0.12 210)',
    green: 'oklch(62% 0.15 150)',
    amber: 'oklch(72% 0.14 75)',
    rose: 'oklch(62% 0.18 20)',
    pink: 'oklch(64% 0.18 350)'
  };

  $: accent = user?.accentColor && ACCENT_MAP[user.accentColor] ? ACCENT_MAP[user.accentColor] : null;
  $: accentStyle = accent ? `--weeb-accent: ${accent};` : '';

  $: displayName =
    [user?.firstname, user?.lastname].filter(Boolean).join(' ').trim() || user?.username || 'User';
  $: initials = (
    (user?.firstname?.[0] || user?.username?.[0] || '?') + (user?.lastname?.[0] || '')
  ).toUpperCase();

  // cdn_user_url comes from the hydrated config, so these recompute once the
  // root layout populates the store -- the staging fallback only ever shows for
  // the instant before hydration and matches staging anyway.
  $: cdnBase = $configStore?.cdn_user_url || 'https://cdn.weeb.vip/weeb-user-staging';
  $: bannerUrl = user?.bannerImageUrl ? `${cdnBase}/${user.bannerImageUrl}` : undefined;
  $: avatarUrl = user?.profileImageUrl ? `${cdnBase}/${user.profileImageUrl}` : undefined;

  $: watchingAnimes = lists?.watching?.animes ?? [];
  $: readingWorks = lists?.reading?.works ?? [];
  $: animeCounts = lists?.animeCounts ?? null;
  $: workCounts = lists?.workCounts ?? null;

  // The header's numbers. The count fields are Int64 scalars, which arrive over
  // JSON as strings -- so they are coerced before any arithmetic, or the sum
  // would concatenate ("0" + "1" + "2" -> "012") instead of adding.
  const num = (v: any): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  $: totalTracked =
    (animeCounts
      ? num(animeCounts.watching) +
        num(animeCounts.planToWatch) +
        num(animeCounts.completed) +
        num(animeCounts.onHold) +
        num(animeCounts.dropped)
      : 0) +
    (workCounts
      ? num(workCounts.reading) +
        num(workCounts.planToRead) +
        num(workCounts.completed) +
        num(workCounts.onHold) +
        num(workCounts.dropped)
      : 0);

  $: stats = user?.listsPublic
    ? [
        { label: 'Tracked', value: totalTracked },
        { label: 'Watching', value: num(animeCounts?.watching) },
        { label: 'Anime done', value: num(animeCounts?.completed) },
        { label: 'Reading', value: num(workCounts?.reading) },
        { label: 'Manga done', value: num(workCounts?.completed) }
      ]
    : [];
</script>

<div class="public-page" style={accentStyle}>
  <!-- Header -->
  <header class="hero">
    <div class="hero-banner" class:hero-banner--empty={!bannerUrl}>
      {#if bannerUrl}
        <img class="hero-banner-img" src={bannerUrl} alt={`${displayName}'s banner`} />
      {/if}
      <div class="hero-banner-scrim"></div>
    </div>

    <div class="hero-body">
      <div class="hero-avatar">
        {#if avatarUrl}
          <img class="hero-avatar-img" src={avatarUrl} alt={displayName} />
        {:else}
          <span class="hero-avatar-initials">{initials}</span>
        {/if}
      </div>

      <div class="hero-identity">
        <h1 class="hero-name">{displayName}</h1>
        <p class="hero-handle">@{user?.username}</p>
        {#if user?.bio}
          <p class="hero-bio">{user.bio}</p>
        {/if}
      </div>

      {#if stats.length > 0}
        <dl class="hero-stats">
          {#each stats as stat}
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
  {#if !user?.listsPublic}
    <div class="private-note">
      <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      <div>
        <p class="private-note-title">These lists are private</p>
        <p class="private-note-sub">{displayName} hasn't made their anime and manga public.</p>
      </div>
    </div>
  {:else}
    <!-- Currently Watching -->
    <section class="section">
      <div class="section-header">
        <div class="section-header-left">
          <svg width="18" height="18" fill="none" stroke="var(--weeb-accent)" stroke-width="2" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="15" rx="2"/><path d="M17 2l-5 5-5-5"/></svg>
          <h2 class="section-title">Currently Watching</h2>
          {#if watchingAnimes.length > 0}
            <span class="section-count">{watchingAnimes.length}</span>
          {/if}
        </div>
      </div>

      {#if watchingAnimes.length > 0}
        <PosterGrid>
          {#each watchingAnimes as entry (entry.id)}
            <PosterCard
              id={entry.anime?.id ?? ''}
              slug={entry.anime?.slug}
              title={entry.anime?.titleEn || entry.anime?.titleJp || 'Untitled'}
              image={entry.anime?.id ?? ''}
              status={entry.anime?.animeStatus || null}
              sub={entry.anime?.episodeCount ? `${entry.anime.episodeCount} episodes` : ''}
              genres={entry.anime?.tags || []}
              description={entry.anime?.description || ''}
              episodeCount={entry.anime?.episodeCount}
              onList={entry.status || 'watching'}
            />
          {/each}
        </PosterGrid>
      {:else}
        <p class="section-empty">Not watching anything right now.</p>
      {/if}
    </section>

    <!-- Currently Reading -->
    <section class="section">
      <div class="section-header">
        <div class="section-header-left">
          <svg width="18" height="18" fill="none" stroke="var(--weeb-accent)" stroke-width="2" viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          <h2 class="section-title">Currently Reading</h2>
          {#if readingWorks.length > 0}
            <span class="section-count">{readingWorks.length}</span>
          {/if}
        </div>
      </div>

      {#if readingWorks.length > 0}
        <PosterGrid>
          {#each readingWorks as entry (entry.id)}
            <PosterCard
              id={entry.work?.id ?? ''}
              title={entry.work?.titleEn || entry.work?.titleJp || 'Untitled'}
              image={entry.work?.id ?? ''}
              imagePath="works"
              score={entry.work?.score ?? null}
              sub={workSubtitle(entry.work?.type, entry.work?.publishedFrom)}
              href={entry.work?.urlSlug ? `/manga/${entry.work.urlSlug}` : '/search'}
              onList={entry.status || 'reading'}
            />
          {/each}
        </PosterGrid>
      {:else}
        <p class="section-empty">Not reading anything right now.</p>
      {/if}
    </section>
  {/if}
  </div>
</div>

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
    background: var(--weeb-surface, rgba(255, 255, 255, 0.03));
    border-bottom: 1px solid var(--weeb-border, rgba(255, 255, 255, 0.08));
  }

  .hero-banner {
    position: relative;
    height: clamp(140px, 26vw, 260px);
    background: linear-gradient(120deg, color-mix(in oklch, var(--weeb-accent) 40%, transparent), transparent 70%);
  }
  .hero-banner--empty {
    background:
      radial-gradient(120% 140% at 15% 0%, color-mix(in oklch, var(--weeb-accent) 32%, transparent), transparent 60%),
      linear-gradient(180deg, rgba(255, 255, 255, 0.04), transparent);
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
    background: linear-gradient(180deg, transparent 40%, color-mix(in srgb, var(--weeb-bg, #0b0b12) 88%, transparent));
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

  .hero-avatar {
    grid-area: avatar;
    width: 108px;
    height: 108px;
    border-radius: 50%;
    overflow: hidden;
    border: 4px solid var(--weeb-bg, #0b0b12);
    background: color-mix(in oklch, var(--weeb-accent) 55%, #1a1a24);
    display: grid;
    place-items: center;
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.4);
  }
  .hero-avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .hero-avatar-initials {
    font-size: 2.2rem;
    font-weight: 700;
    color: #fff;
    letter-spacing: 0.02em;
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
    color: var(--weeb-fg, #f4f4f8);
    margin: 0;
  }
  .hero-handle {
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 0.85rem;
    color: var(--weeb-accent);
    margin: 0.15rem 0 0;
  }
  .hero-bio {
    margin: 0.6rem 0 0;
    max-width: 60ch;
    font-size: 0.95rem;
    line-height: 1.5;
    color: var(--weeb-fg-muted, rgba(244, 244, 248, 0.72));
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
    background: var(--weeb-surface, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--weeb-border, rgba(255, 255, 255, 0.07));
    min-width: 84px;
  }
  .hero-stat-label {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--weeb-fg-muted, rgba(244, 244, 248, 0.6));
  }
  .hero-stat-value {
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 1.35rem;
    font-weight: 600;
    line-height: 1;
    margin: 0;
    color: var(--weeb-fg, #f4f4f8);
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
    color: var(--weeb-fg, #f4f4f8);
    margin: 0;
  }
  .section-count {
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 0.8rem;
    font-weight: 600;
    padding: 0.1rem 0.5rem;
    border-radius: 999px;
    color: var(--weeb-accent);
    background: color-mix(in oklch, var(--weeb-accent) 16%, transparent);
  }
  .section-empty {
    color: var(--weeb-fg-muted, rgba(244, 244, 248, 0.55));
    font-size: 0.92rem;
    padding: 0.5rem 0;
  }

  .private-note {
    display: flex;
    align-items: center;
    gap: 0.9rem;
    margin-top: 2.5rem;
    padding: 1.1rem 1.25rem;
    border-radius: 12px;
    color: var(--weeb-fg-muted, rgba(244, 244, 248, 0.7));
    background: var(--weeb-surface, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--weeb-border, rgba(255, 255, 255, 0.08));
  }
  .private-note-title {
    font-weight: 600;
    color: var(--weeb-fg, #f4f4f8);
    margin: 0;
  }
  .private-note-sub {
    margin: 0.15rem 0 0;
    font-size: 0.9rem;
  }

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
    .hero-avatar {
      width: 88px;
      height: 88px;
    }
  }
</style>
