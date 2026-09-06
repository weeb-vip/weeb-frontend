<script lang="ts">
  import Chip from '$lib/components/primitives/Chip';
  import SafeImage from '$lib/components/primitives/SafeImage';
  import EmptyState from '$lib/components/primitives/EmptyState';
  import ErrorBanner from '$lib/components/primitives/ErrorBanner';
  import ChipGroup from '$lib/components/primitives/ChipGroup';
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
    <!-- `mode="toggle"` rather than ChipGroup's `tabs` default, which is what
         this rendered as: a real `role="tablist"` of `role="tab"`s.
         That was a promise the control cannot keep. Tabs name one of several
         PANELS and reveal the one you pick, so assistive tech announces the move
         and then expects a `tabpanel` to land in -- and there was none here, nor
         anywhere in the app. This strip reveals nothing: it narrows ONE grid,
         in place, and the grid stays the same region whichever chip is on.
         The buckets are not disjoint panels either -- "All" is a superset of the
         other three, which is a filter, not a tab set.
         So the fix is to stop claiming tabs rather than to invent panels for
         them: `toggle` keeps each chip a real button, marks the active one with
         `aria-pressed`, and leaves every chip its own tab stop, which is what a
         reader expects of a filter row. The grid below is described by the
         group's own name instead of by an `aria-controls` that would have to
         point at a panel that is not one. -->
    <ChipGroup
      items={bloc.filters.map((option) => ({ value: option.value, label: option.label }))}
      value={bloc.filter}
      onSelect={(value) => bloc.selectFilter(value)}
      variant="pill"
      mode="toggle"
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
                <!-- The credited voice actor is the first one, so it is the
                     one selected. Same pill as every other pill. -->
                <Chip size="sm" href={`/people/${va.slug || va.id}`} selected={vaIdx === 0}>
                  <span class="va-name">{va.givenName} {va.familyName}</span>
                  {#if va.language}
                    <span class="va-lang">{va.language}</span>
                  {/if}
                </Chip>
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
    border-radius: var(--weeb-radius);
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
    border-radius: var(--weeb-radius);
    flex-shrink: 0;
    position: relative;
    overflow: hidden;
  }
  :global(.char-portrait-img) {
    width: 48px !important;
    height: 48px !important;
    object-fit: cover;
    border-radius: var(--weeb-radius);
  }
  /* Eight grounds behind a missing portrait, so a wall of them is not one flat
     grey. They were eight hardcoded oklch() pairs; they are now one gradient
     tinted by a per-index step off the accent, which is the same variation
     without eight literals the palette does not know about. */
  .char-portrait[class*='char-portrait-'] {
    background: linear-gradient(
      135deg,
      color-mix(in oklch, var(--weeb-accent) var(--portrait-tint, 14%), var(--weeb-surface)),
      var(--weeb-bg-elevated)
    );
  }
  .char-portrait-0 { --portrait-tint: 10%; }
  .char-portrait-1 { --portrait-tint: 22%; }
  .char-portrait-2 { --portrait-tint: 6%; }
  .char-portrait-3 { --portrait-tint: 18%; }
  .char-portrait-4 { --portrait-tint: 28%; }
  .char-portrait-5 { --portrait-tint: 4%; }
  .char-portrait-6 { --portrait-tint: 24%; }
  .char-portrait-7 { --portrait-tint: 14%; }

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
    color: var(--weeb-accent-text);
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
    background: color-mix(in oklch, var(--weeb-bg) 60%, var(--weeb-surface));
  }

  /* Shape, hover and selected state all come from Chip. What is left is the
     two-part label inside it. */
  .va-name {
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