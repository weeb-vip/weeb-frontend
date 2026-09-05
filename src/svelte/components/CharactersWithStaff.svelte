<script lang="ts">
  import SafeImage from './SafeImage.svelte';
  import EmptyState from './EmptyState.svelte';
  import ErrorBanner from './ErrorBanner.svelte';
  import Tabs from './Tabs.svelte';
  import {
    CharactersWithStaffBloc,
    type CharacterEntry,
  } from './CharactersWithStaff.bloc.svelte';

  /**
   * The cast of a show, with the voice actors behind it.
   *
   * A view over the bloc: it decides what is on screen and which cards are
   * open, this renders it.
   */
  let {
    animeId,
    /** The loader's payload, when the page was rendered with the cast already in hand. */
    ssrCharactersData = null,
    bloc = new CharactersWithStaffBloc({ source: () => ({ animeId, ssrCharactersData }) }),
  }: {
    animeId: string;
    ssrCharactersData?: { charactersAndStaffByAnimeId?: CharacterEntry[] | null } | null;
    bloc?: CharactersWithStaffBloc;
  } = $props();
</script>

{#if bloc.isLoading}
  <div class="chars-loading">
    <div class="chars-spinner"></div>
  </div>
{:else if bloc.isError}
  <!-- A failed fetch is not an empty cast: the show may well have one, so this
       says what happened and offers the retry rather than asserting there is
       nobody to list. -->
  <ErrorBanner
    message="Couldn't load the cast."
    detail={bloc.errorDetail}
    retrying={bloc.isRetrying}
    onRetry={() => bloc.retry()}
  />
{:else if bloc.isEmpty}
  <EmptyState size="compact" message="No character data available." />
{:else}
  <div class="chars-root">
    <Tabs
      items={bloc.filters.map((option) => ({ value: option.value, label: option.label }))}
      value={bloc.filter}
      onChange={(value) => bloc.selectFilter(value)}
      variant="pill"
      ariaLabel="Filter characters by role"
    />

    <!-- Character Grid -->
    <div class="chars-grid">
      {#each bloc.visible as entry, idx (entry.character.name || `char-${idx}`)}
        {@const isExpanded = bloc.isExpanded(entry)}
        {@const hasMultipleVAs = bloc.hasMultipleVoiceActors(entry)}
        {@const primaryVA = bloc.primaryVoiceActor(entry)}

        <div class="char-card" class:expanded={isExpanded}>
          <!-- Main card content -->
          <!-- Renders a real <button> when the card is expandable (native keyboard support),
               otherwise a plain non-interactive <div> -->
          <svelte:element
            this={hasMultipleVAs ? 'button' : 'div'}
            type={hasMultipleVAs ? 'button' : undefined}
            role={hasMultipleVAs ? 'button' : undefined}
            class="char-card-main"
            aria-expanded={hasMultipleVAs ? isExpanded : undefined}
            onclick={() => bloc.toggleExpanded(entry)}
          >
            <div class="char-portrait char-portrait-{idx % 8}">
              <SafeImage
                src={entry.character.id ?? ''}
                path="characters"
                alt={entry.character.name || ''}
                className="char-portrait-img"
              />
            </div>
            <div class="char-info">
              <div class="char-name">{entry.character.name || 'Unknown'}</div>
              <div class="char-role" class:main={bloc.isLeadRole(entry)}>
                {entry.character.role || 'Character'}
              </div>
              {#if primaryVA}
                <!--
                  A link to the voice actor's page, except where the card is
                  itself a <button> (the multiple-VA case) -- an <a> nested in a
                  button is invalid and unreachable by keyboard. Those cards
                  expand instead, and every name in the expanded list links.
                -->
                {#if hasMultipleVAs}
                  <div class="char-va">
                    {primaryVA.givenName} {primaryVA.familyName}
                    {#if primaryVA.language}
                      <span class="char-va-lang">({primaryVA.language})</span>
                    {/if}
                  </div>
                {:else}
                  <a class="char-va char-va-link" href={`/people/${primaryVA.slug || primaryVA.id}`}>
                    {primaryVA.givenName} {primaryVA.familyName}
                    {#if primaryVA.language}
                      <span class="char-va-lang">({primaryVA.language})</span>
                    {/if}
                  </a>
                {/if}
              {/if}
              {#if hasMultipleVAs}
                <div class="char-va-more">
                  +{(entry.staff?.length ?? 0) - 1} more VA{(entry.staff?.length ?? 0) - 1 > 1 ? 's' : ''}
                  <svg class="expand-icon" class:rotated={isExpanded} width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M2.5 4L5 6.5L7.5 4"/>
                  </svg>
                </div>
              {/if}
            </div>
          </svelte:element>

          <!-- Expanded VA list -->
          {#if isExpanded && entry.staff}
            <div class="char-va-list">
              {#each entry.staff as va, vaIdx}
                <a class="va-chip" class:active={vaIdx === 0} href={`/people/${va.slug || va.id}`}>
                  <span class="va-name">{va.givenName} {va.familyName}</span>
                  {#if va.language}
                    <span class="va-lang">{va.language}</span>
                  {/if}
                </a>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </div>

    {#if bloc.isFilteredOut}
      <EmptyState
        size="compact"
        message="No characters found for this filter."
        action={{ label: 'Show all', onClick: () => bloc.selectFilter('all'), variant: 'ghost' }}
      />
    {/if}
  </div>
{/if}

<style>
  .chars-loading {
    display: flex;
    justify-content: center;
    padding: 32px 0;
  }
  .chars-spinner {
    width: 32px;
    height: 32px;
    border: 2px solid var(--weeb-border);
    border-top-color: var(--weeb-accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .chars-root {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .chars-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 12px;
  }

  .char-card {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--weeb-border);
    border-radius: var(--weeb-radius, 8px);
    background: var(--weeb-bg-elevated);
    transition: border-color 0.15s, background 0.15s;
    overflow: hidden;
  }
  .char-card:hover {
    border-color: var(--weeb-accent);
    background: var(--weeb-surface);
  }

  .char-card-main {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px;
    cursor: default;
    /* resets so the <button> variant renders identically to the <div> variant */
    width: 100%;
    margin: 0;
    border: none;
    background: none;
    font: inherit;
    color: inherit;
    text-align: left;
  }
  .char-card-main:has(+ .char-va-list),
  .char-card:not(.expanded) .char-card-main {
    cursor: pointer;
  }

  .char-portrait {
    width: 48px;
    height: 48px;
    border-radius: var(--weeb-radius, 8px);
    flex-shrink: 0;
    position: relative;
    overflow: hidden;
  }
  :global(.char-portrait-img) {
    width: 48px !important;
    height: 48px !important;
    object-fit: cover;
    border-radius: var(--weeb-radius, 8px);
  }
  .char-portrait-0 { background: linear-gradient(135deg, oklch(28% 0.06 280), oklch(18% 0.04 300)); }
  .char-portrait-1 { background: linear-gradient(135deg, oklch(32% 0.08 260), oklch(20% 0.05 280)); }
  .char-portrait-2 { background: linear-gradient(135deg, oklch(26% 0.07 290), oklch(16% 0.04 270)); }
  .char-portrait-3 { background: linear-gradient(135deg, oklch(30% 0.09 270), oklch(18% 0.05 295)); }
  .char-portrait-4 { background: linear-gradient(135deg, oklch(34% 0.10 275), oklch(22% 0.07 300)); }
  .char-portrait-5 { background: linear-gradient(135deg, oklch(24% 0.06 285), oklch(14% 0.03 265)); }
  .char-portrait-6 { background: linear-gradient(135deg, oklch(28% 0.08 300), oklch(18% 0.05 280)); }
  .char-portrait-7 { background: linear-gradient(135deg, oklch(32% 0.07 265), oklch(20% 0.04 290)); }

  .char-info {
    min-width: 0;
    flex: 1;
  }

  .char-name {
    font-size: 13px;
    font-weight: 700;
    color: var(--weeb-fg);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .char-role {
    font-family: var(--weeb-font-mono);
    font-size: 10px;
    color: var(--weeb-violet);
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    margin-top: 2px;
  }
  .char-role.main {
    color: var(--weeb-accent-text);
  }

  .char-va {
    font-size: 12px;
    color: var(--weeb-fg-muted);
    margin-top: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .char-va-lang {
    font-size: 10px;
    opacity: 0.7;
  }

  /* The voice actor's name is the one link on an otherwise inert card, so it
     needs to look like one on hover without shouting at rest -- the character
     is the subject here, the actor is the cross-reference. */
  .char-va-link {
    display: block;
    text-decoration: none;
    color: var(--weeb-fg-muted);
    transition: color 0.15s;
  }
  .char-va-link:hover,
  .char-va-link:focus-visible {
    color: var(--weeb-accent-text, var(--weeb-fg));
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .char-va-more {
    font-size: 11px;
    color: var(--weeb-accent-text);
    margin-top: 3px;
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
  }
  .expand-icon {
    transition: transform 0.2s;
  }
  .expand-icon.rotated {
    transform: rotate(180deg);
  }

  /* Expanded VA list */
  .char-va-list {
    border-top: 1px solid var(--weeb-border);
    padding: 10px 14px;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    background: oklch(16% 0.012 275);
  }

  .va-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 999px;
    border: 1px solid var(--weeb-border);
    font-size: 11px;
    transition: all 0.15s;
  }
  .va-chip.active {
    border-color: var(--weeb-accent);
    background: oklch(22% 0.03 280);
  }
  a.va-chip {
    text-decoration: none;
    cursor: pointer;
  }
  a.va-chip:hover,
  a.va-chip:focus-visible {
    border-color: var(--weeb-accent);
    background: var(--weeb-surface-hover);
  }
  a.va-chip:hover .va-name,
  a.va-chip:focus-visible .va-name {
    color: var(--weeb-fg);
  }
  .va-name {
    color: var(--weeb-fg-secondary);
    font-weight: 500;
  }
  .va-lang {
    font-family: var(--weeb-font-mono);
    font-size: 9px;
    color: var(--weeb-fg-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  /* Responsive */
  @media (max-width: 1200px) {
    .chars-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }
  @media (max-width: 768px) {
    .chars-grid {
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
    }
    .char-card-main {
      padding: 10px;
      gap: 10px;
    }
    .char-portrait {
      width: 40px;
      height: 40px;
    }
    :global(.char-portrait-img) {
      width: 40px !important;
      height: 40px !important;
    }
    .char-name {
      font-size: 12px;
    }
    .char-va {
      font-size: 11px;
    }
  }
  @media (max-width: 480px) {
    .chars-grid {
      grid-template-columns: 1fr;
    }
  }
</style>