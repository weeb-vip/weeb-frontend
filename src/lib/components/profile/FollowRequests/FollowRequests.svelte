<script lang="ts">
  import Button from '$lib/components/primitives/Button';
  import ProfileAvatar from '$lib/components/profile/ProfileAvatar';
  import { FollowRequestsBloc } from './FollowRequests.bloc.svelte';
  import { serverAuthFromContext } from '$lib/stores/server-auth';

  const serverAuth = serverAuthFromContext();
  let { bloc = new FollowRequestsBloc({ serverAuth }) }: { bloc?: FollowRequestsBloc } = $props();
</script>

{#if bloc.hasRequests}
  <section class="requests" aria-labelledby="follow-requests-title">
    <div class="requests-head">
      <h2 id="follow-requests-title" class="requests-title">Follow requests</h2>
      <span class="requests-count">{bloc.total}</span>
    </div>
    <ul class="requests-list">
      {#each bloc.requests as person (person.id)}
        <li class="request">
          <a class="request-who" href={`/u/${encodeURIComponent(person.username)}`}>
            <ProfileAvatar username={person.username} profileImageUrl={person.profileImageUrl} size="md" linkToProfile={false} />
            <span class="request-names">
              <span class="request-name">{person.name}</span>
              <span class="request-handle">@{person.username}</span>
            </span>
          </a>
          <div class="request-actions">
            <Button size="sm" loading={bloc.isBusy(person.id)} onClick={() => bloc.accept(person.id)} ariaLabel={`Accept ${person.username}`}>Accept</Button>
            <Button size="sm" color="transparent" disabled={bloc.isBusy(person.id)} onClick={() => bloc.decline(person.id)} ariaLabel={`Decline ${person.username}`}>Decline</Button>
          </div>
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  .requests {
    max-width: 1180px;
    margin: 1.5rem auto 0;
    padding: 1rem 1.25rem;
    background: var(--weeb-surface);
    border: 1px solid var(--weeb-border);
    border-radius: 10px;
  }
  .requests-head {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin-bottom: 0.75rem;
  }
  .requests-title {
    font-size: 1.05rem;
    font-weight: 700;
    color: var(--weeb-fg);
    margin: 0;
  }
  .requests-count {
    font-family: var(--weeb-font-mono, ui-monospace, monospace);
    font-size: 0.8rem;
    font-weight: 600;
    padding: 0.1rem 0.5rem;
    border-radius: 999px;
    color: var(--weeb-accent);
    background: color-mix(in oklch, var(--weeb-accent) 16%, transparent);
  }
  .requests-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .request {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .request-who {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    text-decoration: none;
    min-width: 0;
  }
  .request-names {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .request-name {
    font-weight: 600;
    color: var(--weeb-fg);
  }
  .request-handle {
    font-family: var(--weeb-font-mono, ui-monospace, monospace);
    font-size: 0.75rem;
    color: var(--weeb-fg-muted);
  }
  .request-actions {
    display: flex;
    gap: 0.5rem;
  }
</style>
