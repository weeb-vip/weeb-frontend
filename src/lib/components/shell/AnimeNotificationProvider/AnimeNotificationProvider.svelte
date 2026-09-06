<script lang="ts">
  import { AnimeNotificationProviderBloc } from './AnimeNotificationProvider.bloc.svelte';

  /** Renders nothing; it exists to start episode notifications on the client. */
  let {
    bloc = new AnimeNotificationProviderBloc(),
  }: { bloc?: AnimeNotificationProviderBloc } = $props();

  // $effect runs on the client only, which is what the old onMount was for.
  $effect(() => bloc.start());
</script>
