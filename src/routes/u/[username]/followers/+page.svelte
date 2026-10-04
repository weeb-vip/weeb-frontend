<script lang="ts">
  import Seo from '$lib/Seo.svelte';
  import FollowList from '$lib/components/profile/FollowList';

  let { data }: { data: any } = $props();

  const user = $derived(data.user);
  const displayName = $derived(
    [user?.firstname, user?.lastname].filter(Boolean).join(' ').trim() || user?.username
  );
  const isFollowers = $derived(data.kind === 'followers');
  const title = $derived(isFollowers ? `People following ${displayName}` : `People ${displayName} follows`);
  const base = $derived(`/u/${encodeURIComponent(user?.username ?? '')}`);
</script>

<Seo title={`${title} (@${user?.username})`} description={title} noIndex={true} />

<div class="follow-page">
  <nav class="follow-tabs" aria-label="Profile sections">
    <a href={base}>@{user?.username}</a>
    <a href={`${base}/followers`} aria-current={isFollowers ? 'page' : undefined}>Followers <strong>{data.followInfo?.followerCount ?? 0}</strong></a>
    <a href={`${base}/following`} aria-current={!isFollowers ? 'page' : undefined}>Following <strong>{data.followInfo?.followingCount ?? 0}</strong></a>
  </nav>

  <h1 class="follow-title">{title}</h1>

  <FollowList
    users={data.list.users}
    total={Number(data.list.total ?? 0)}
    page={data.page}
    limit={Number(data.list.limit ?? 30)}
    baseHref={`${base}/${data.kind}`}
    hidden={data.hidden}
    empty={isFollowers ? `${displayName} has no followers yet.` : `${displayName} isn't following anyone yet.`}
  />
</div>

<style>
  .follow-page {
    max-width: 720px;
    margin: 0 auto;
    padding: 1.5rem 1rem 4rem;
  }
  .follow-tabs {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    margin-bottom: 1rem;
    font-size: 0.9rem;
  }
  .follow-tabs a {
    color: var(--weeb-fg-muted);
    text-decoration: none;
    padding-bottom: 0.25rem;
    border-bottom: 2px solid transparent;
  }
  .follow-tabs a[aria-current='page'] {
    color: var(--weeb-fg);
    border-bottom-color: var(--weeb-accent);
  }
  .follow-tabs strong {
    font-family: var(--weeb-font-mono, ui-monospace, monospace);
    color: var(--weeb-fg);
  }
  .follow-title {
    font-size: 1.3rem;
    font-weight: 700;
    color: var(--weeb-fg);
    margin: 0 0 1rem;
  }
</style>
