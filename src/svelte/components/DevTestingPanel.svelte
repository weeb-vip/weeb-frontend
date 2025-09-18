<script>
  import { toast } from 'svelte-sonner';
  import { animeToast } from '../utils/animeToast';

  // Only show in development
  const isDev = import.meta.env.DEV;

  // Sample anime data for testing
  const sampleAnime = {
    id: '16498', // Attack on Titan MAL ID
    titleEn: 'Attack on Titan',
    titleJp: '進撃の巨人',
    imageUrl: 'https://cdn.myanimelist.net/images/anime/1000/110531.jpg'
  };

  const sampleEpisode = {
    episodeNumber: 87,
    titleEn: 'The Dawn of Humanity',
    titleJp: '人類の夜明け'
  };

  function testSuccessToast() {
    toast.success('Attack on Titan - Episode 24 has finished airing');
  }

  function testWarningToast() {
    toast.warning('Demon Slayer - Episode 12 starts in 5 minutes');
  }

  function testInfoToast() {
    toast.info('Now Airing: One Piece - Episode 1087: The Final Battle');
  }

  function testErrorToast() {
    toast.error('Failed to load anime data. Please try again.');
  }

  // Anime-specific toast tests
  function testAnimeAiringSoon() {
    console.log('🧪 Manual test: airing soon toast');
    animeToast.airingSoon(sampleAnime, sampleEpisode, 30);
  }

  function testAnimeWarning() {
    console.log('🧪 Manual test: warning toast');
    animeToast.warning(sampleAnime, sampleEpisode);
  }

  function testAnimeNowAiring() {
    console.log('🧪 Manual test: now airing toast');
    animeToast.nowAiring(sampleAnime, sampleEpisode);
  }

  function testAnimeFinished() {
    console.log('🧪 Manual test: finished toast');
    animeToast.finished(sampleAnime, sampleEpisode);
  }
</script>

{#if isDev}
  <div class="fixed bottom-4 left-4 z-50 bg-gray-900 text-white p-4 rounded-lg shadow-lg border border-gray-700">
    <h3 class="text-sm font-bold mb-3 text-yellow-400">🛠️ Dev Testing Panel</h3>

    <!-- Standard Toasts -->
    <div class="mb-3">
      <div class="text-xs text-gray-400 mb-2">Standard Toasts</div>
      <div class="grid grid-cols-2 gap-2">
        <button
          on:click={testSuccessToast}
          class="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-xs transition-colors"
        >
          Success
        </button>
        <button
          on:click={testWarningToast}
          class="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 rounded text-xs transition-colors"
        >
          Warning
        </button>
        <button
          on:click={testInfoToast}
          class="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs transition-colors"
        >
          Info
        </button>
        <button
          on:click={testErrorToast}
          class="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-xs transition-colors"
        >
          Error
        </button>
      </div>
    </div>

    <!-- Anime Toasts -->
    <div>
      <div class="text-xs text-gray-400 mb-2">Anime Toasts</div>
      <div class="grid grid-cols-2 gap-2">
        <button
          on:click={testAnimeAiringSoon}
          class="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs transition-colors"
        >
          <i class="fas fa-clock mr-1"></i> Airing Soon
        </button>
        <button
          on:click={testAnimeWarning}
          class="px-3 py-1 bg-orange-600 hover:bg-orange-700 rounded text-xs transition-colors"
        >
          <i class="fas fa-bell mr-1"></i> Warning
        </button>
        <button
          on:click={testAnimeNowAiring}
          class="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-xs transition-colors"
        >
          <i class="fas fa-play-circle mr-1"></i> Now Airing
        </button>
        <button
          on:click={testAnimeFinished}
          class="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-xs transition-colors"
        >
          <i class="fas fa-check-circle mr-1"></i> Finished
        </button>
      </div>
    </div>
  </div>
{/if}