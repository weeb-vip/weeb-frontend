<script lang="ts">
  import { format } from 'date-fns';
  import AnimeCard from './AnimeCard.svelte';
  import AnimeStatusDropdown from './AnimeStatusDropdown.svelte';
  import Button from './Button.svelte';
  import { GetImageFromAnime } from '../../services/utils';
  import { animeNotificationStore } from '../stores/animeNotifications';
  import { preferencesStore, getAnimeTitle } from '../stores/preferences';

  export let entry: any;
  export let index: number;
  export let animeStatuses: Record<string, 'idle' | 'loading' | 'success' | 'error'>;
  export let handleAddAnime: (id: string, animeId: string) => void;
  export let hoveredAnime: any;
  export let setHoveredAnime: (anime: any) => void;
  export let onDelete: (animeId: string) => void;
  export let onStatusChange: (event: CustomEvent) => void;

  $: airingInfo = entry.airingInfo;
  $: anime = entry.anime;

  // Get timing data from the store
  $: timingDataStore = animeNotificationStore.getTimingData(anime.id);
  $: timingData = $timingDataStore;

  // Create air time display using worker data or fallback
  $: airTimeDisplay = timingData ? {
    show: true,
    text: timingData.isCurrentlyAiring
      ? (timingData.countdown && timingData.countdown !== "AIRING NOW" ? `Airing (${timingData.countdown})` : "Airing")
      : timingData.hasAlreadyAired
        ? "Recently aired"
        : timingData.countdown ? `Airing in ${timingData.countdown}` : timingData.airDateTime,
    variant: timingData.isCurrentlyAiring
      ? 'airing'
      : timingData.hasAlreadyAired
        ? 'aired'
        : 'countdown'
  } : airingInfo.airTimeDisplay;

  // Episode info using worker data or fallback
  $: episodeTitle = timingData?.episode?.titleEn || timingData?.episode?.titleJp || airingInfo.nextEpisode?.titleEn || airingInfo.nextEpisode?.titleJp || "Unknown";
  $: episodeNumber = timingData?.episode?.episodeNumber?.toString() || airingInfo.nextEpisode?.episodeNumber?.toString() || "Unknown";
</script>

<div
  class="{index >= 5 ? 'lg:hidden xl:block' : ''}"
  on:mouseenter={() => setHoveredAnime(airingInfo)}
  on:mouseleave={() => setHoveredAnime(null)}
>
  <AnimeCard
    style="episode"
    id={anime.id}
    title={getAnimeTitle(anime, $preferencesStore.titleLanguage)}
    episodeTitle={episodeTitle}
    episodeNumber={episodeNumber}
    description=""
    episodeLength=""
    year=""
    image={GetImageFromAnime(anime)}
    airdate={airingInfo.nextEpisode?.airDate ? format(new Date(airingInfo.nextEpisode.airDate), "EEE MMM do") : "Unknown"}
    airTime={airTimeDisplay}
    entry={anime.userAnime}
    className="hover:cursor-pointer"
  >
    <div slot="options">
      {#if !anime.userAnime}
        <Button
          color="blue"
          label="Add to list"
          showLabel={true}
          status={animeStatuses[`currently-airing-${anime.id}`] || 'idle'}
          className="w-fit px-2 py-1 text-xs"
          onClick={() => handleAddAnime(`currently-airing-${anime.id}`, anime.id)}
        />
      {:else}
        <AnimeStatusDropdown
          entry={{
            ...anime.userAnime,
            anime: airingInfo
          }}
          variant="compact"
          on:statusChange={onStatusChange}
          on:delete={(event) => {
            console.log('🎯 CurrentlyAiringCard received delete event:', event.detail);
            onDelete(event.detail.animeId);
          }}
        />
      {/if}
    </div>
  </AnimeCard>
</div>
