<script lang="ts">
  import Seo from '$lib/Seo.svelte';
  import PublicUserPage from '../../../svelte/components/PublicUserPage.svelte';

  export let data;

  $: user = data.user;
  $: displayName =
    [user?.firstname, user?.lastname].filter(Boolean).join(' ').trim() || user?.username;
  $: description = user?.bio
    ? user.bio
    : `${displayName}'s anime and manga on weeb.vip.`;
</script>

<Seo title={`${displayName} (@${user?.username})`} description={description} />

<PublicUserPage user={data.user} lists={data.lists} />
