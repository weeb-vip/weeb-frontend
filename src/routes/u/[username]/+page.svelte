<script lang="ts">
  import Seo from '$lib/Seo.svelte';
  import PublicUserPage from '../../../svelte/components/PublicUserPage.svelte';

  let { data }: { data: any } = $props();

  const user = $derived(data.user);
  const displayName = $derived(
    [user?.firstname, user?.lastname].filter(Boolean).join(' ').trim() || user?.username
  );
  const description = $derived(
    user?.bio ? user.bio : `${displayName}'s anime and manga on weeb.vip.`
  );
</script>

<Seo title={`${displayName} (@${user?.username})`} {description} />

<PublicUserPage user={data.user} lists={data.lists} />
