<script lang="ts">
  import ProfileAvatar from '$lib/components/profile/ProfileAvatar';
  import EmptyState from '$lib/components/primitives/EmptyState';
  import Button from '$lib/components/primitives/Button';
  import FollowButton from '$lib/components/profile/FollowButton';

  /**
   * A page of people: followers of someone, or who they follow. Presentational;
   * the route's loader fetched the page and decides the title.
   */
  let {
    users,
    total,
    page,
    limit,
    baseHref,
    empty,
    hidden = false,
  }: {
    users: any[];
    total: number;
    page: number;
    limit: number;
    baseHref: string;
    empty: string;
    /** True when the viewer may not see the names (approval-required account). */
    hidden?: boolean;
  } = $props();

  const totalPages = $derived(Math.max(1, Math.ceil(total / Math.max(1, limit))));
  const nameOf = (u: any) => [u?.firstname, u?.lastname].filter(Boolean).join(' ').trim() || u?.username;
</script>

{#if hidden}
  <EmptyState variant="panel" size="compact" heading="Only followers can see this" message="This account approves its followers, and keeps this list for them." />
{:else if users.length === 0}
  <EmptyState size="compact" message={empty} />
{:else}
  <ul class="people">
    {#each users as person (person.id)}
      <li class="person">
        <a class="person-who" href={`/u/${encodeURIComponent(person.username)}`}>
          <ProfileAvatar username={person.username} profileImageUrl={person.profileImageUrl} size="md" linkToProfile={false} />
          <span class="person-names">
            <span class="person-name">{nameOf(person)}</span>
            <span class="person-handle">@{person.username}</span>
          </span>
        </a>
        <FollowButton target={{ userID: person.id, username: person.username, status: person.viewerFollowStatus ?? 'NONE', followApprovalRequired: false }} />
      </li>
    {/each}
  </ul>

  {#if totalPages > 1}
    <nav class="people-pager" aria-label="Pages">
      <Button size="sm" color="transparent" href={`${baseHref}?page=${page - 1}`} disabled={page <= 1}>Previous</Button>
      <span class="people-pager-status">Page {page} of {totalPages}</span>
      <Button size="sm" color="transparent" href={`${baseHref}?page=${page + 1}`} disabled={page >= totalPages}>Next</Button>
    </nav>
  {/if}
{/if}

<style>
  .people {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .person {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.6rem 0.85rem;
    background: var(--weeb-surface);
    border: 1px solid var(--weeb-border);
    border-radius: 10px;
  }
  .person-who {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    text-decoration: none;
    min-width: 0;
  }
  .person-names {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .person-name {
    font-weight: 600;
    color: var(--weeb-fg);
  }
  .person-handle {
    font-family: var(--weeb-font-mono, ui-monospace, monospace);
    font-size: 0.75rem;
    color: var(--weeb-fg-muted);
  }
  .people-pager {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    margin-top: 1.5rem;
  }
  .people-pager-status {
    font-family: var(--weeb-font-mono, ui-monospace, monospace);
    font-size: 0.8rem;
    color: var(--weeb-fg-muted);
  }
</style>
