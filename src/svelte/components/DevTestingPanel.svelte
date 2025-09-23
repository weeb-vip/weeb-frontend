<script>
  import { toast } from 'svelte-sonner';
  import { animeToast } from '../utils/animeToast';
  import { onMount } from 'svelte';
  import { refreshTokenSimple } from '../../services/queries';
  import debug from '../../utils/debug';
  import { AuthStorage } from '../../utils/auth-storage';

  // Only show in development
  const isDev = __ENABLE_DEV_FEATURES__;

  // Panel state
  let isOpen = false;
  let isMobile = false;

  onMount(() => {
    // Check if mobile on mount and window resize
    const checkMobile = () => {
      isMobile = window.innerWidth < 768; // md breakpoint
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  });

  function togglePanel() {
    isOpen = !isOpen;
  }

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

  async function testRefreshToken() {
    try {
      debug.auth('🧪 Manual test: refresh token');

      // Log initial state
      const initialAuthToken = AuthStorage.getAuthToken();
      const initialRefreshToken = AuthStorage.getRefreshToken();
      debug.auth('Initial token state:', {
        hasAuthToken: !!initialAuthToken,
        hasRefreshToken: !!initialRefreshToken,
        authTokenLength: initialAuthToken?.length,
        refreshTokenLength: initialRefreshToken?.length,
        allCookies: document.cookie
      });

      toast.info('Refreshing authentication token...');

      const result = await refreshTokenSimple();

      if (result?.Credentials?.token) {
        // Check final state
        setTimeout(() => {
          const finalAuthToken = AuthStorage.getAuthToken();
          const finalRefreshToken = AuthStorage.getRefreshToken();
          debug.auth('Final token state after refresh:', {
            hasAuthToken: !!finalAuthToken,
            hasRefreshToken: !!finalRefreshToken,
            authTokenChanged: initialAuthToken !== finalAuthToken,
            refreshTokenChanged: initialRefreshToken !== finalRefreshToken,
            authTokenLength: finalAuthToken?.length,
            refreshTokenLength: finalRefreshToken?.length,
            allCookies: document.cookie
          });
        }, 200);

        toast.success('Token refreshed successfully!');
        debug.success('Manual token refresh completed');
      } else {
        toast.error('Token refresh failed - invalid response');
        debug.error('Token refresh returned invalid response:', result);
      }
    } catch (error) {
      console.error('❌ Manual token refresh failed:', error);

      let message = 'Failed to refresh token';
      if (error?.message) {
        if (error.message.toLowerCase().includes('no refresh token')) {
          message = 'No refresh token found - please log in';
        } else if (error.message.toLowerCase().includes('unauthorized') || error.message.toLowerCase().includes('expired')) {
          message = 'Refresh token expired - please log in again';
        } else if (error.message.length < 80) {
          message = error.message;
        }
      }

      toast.error(message);
    }
  }
</script>

{#if isDev}
  <!-- Desktop: Fixed position panel -->
  {#if !isMobile}
    <div class="fixed bottom-4 left-4 z-50 bg-gray-900 text-white rounded-lg shadow-lg border border-gray-700 transition-all duration-300 {isOpen ? 'p-4' : 'p-3'}">
      {#if isOpen}
        <!-- Full panel content -->
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-bold text-yellow-400">🛠️ Dev Testing Panel</h3>
          <button
            on:click={togglePanel}
            class="text-gray-400 hover:text-white text-xs"
          >
            <i class="fas fa-times"></i>
          </button>
        </div>

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
        <div class="mb-3">
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

        <!-- Auth Tools -->
        <div>
          <div class="text-xs text-gray-400 mb-2">Auth Tools</div>
          <button
            on:click={testRefreshToken}
            class="w-full px-3 py-1 bg-indigo-600 hover:bg-indigo-700 rounded text-xs transition-colors"
          >
            <i class="fas fa-sync mr-1"></i> Refresh Token
          </button>
        </div>
      {:else}
        <!-- Collapsed state -->
        <button
          on:click={togglePanel}
          class="flex items-center gap-2 text-yellow-400 hover:text-yellow-300 text-sm font-bold transition-colors"
        >
          🛠️ <span class="hidden sm:inline">Dev Panel</span>
        </button>
      {/if}
    </div>
  {:else}
    <!-- Mobile: Sticky footer panel -->
    <div class="fixed bottom-0 left-0 right-0 z-50 bg-gray-900 text-white border-t border-gray-700 transition-all duration-300">
      {#if isOpen}
        <!-- Full panel content for mobile -->
        <div class="p-4 max-h-[70vh] overflow-y-auto">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-bold text-yellow-400">🛠️ Dev Testing Panel</h3>
            <button
              on:click={togglePanel}
              class="text-gray-400 hover:text-white text-sm"
            >
              <i class="fas fa-chevron-down"></i>
            </button>
          </div>

          <!-- Standard Toasts -->
          <div class="mb-4">
            <div class="text-xs text-gray-400 mb-2">Standard Toasts</div>
            <div class="grid grid-cols-2 gap-2">
              <button
                on:click={testSuccessToast}
                class="px-3 py-2 bg-green-600 hover:bg-green-700 rounded text-xs transition-colors"
              >
                Success
              </button>
              <button
                on:click={testWarningToast}
                class="px-3 py-2 bg-yellow-600 hover:bg-yellow-700 rounded text-xs transition-colors"
              >
                Warning
              </button>
              <button
                on:click={testInfoToast}
                class="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-xs transition-colors"
              >
                Info
              </button>
              <button
                on:click={testErrorToast}
                class="px-3 py-2 bg-red-600 hover:bg-red-700 rounded text-xs transition-colors"
              >
                Error
              </button>
            </div>
          </div>

          <!-- Anime Toasts -->
          <div class="mb-4">
            <div class="text-xs text-gray-400 mb-2">Anime Toasts</div>
            <div class="grid grid-cols-1 gap-2">
              <button
                on:click={testAnimeAiringSoon}
                class="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-xs transition-colors flex items-center justify-center"
              >
                <i class="fas fa-clock mr-2"></i> Airing Soon
              </button>
              <button
                on:click={testAnimeWarning}
                class="px-3 py-2 bg-orange-600 hover:bg-orange-700 rounded text-xs transition-colors flex items-center justify-center"
              >
                <i class="fas fa-bell mr-2"></i> Warning
              </button>
              <button
                on:click={testAnimeNowAiring}
                class="px-3 py-2 bg-green-600 hover:bg-green-700 rounded text-xs transition-colors flex items-center justify-center"
              >
                <i class="fas fa-play-circle mr-2"></i> Now Airing
              </button>
              <button
                on:click={testAnimeFinished}
                class="px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded text-xs transition-colors flex items-center justify-center"
              >
                <i class="fas fa-check-circle mr-2"></i> Finished
              </button>
            </div>
          </div>

          <!-- Auth Tools -->
          <div>
            <div class="text-xs text-gray-400 mb-2">Auth Tools</div>
            <button
              on:click={testRefreshToken}
              class="w-full px-3 py-2 bg-indigo-600 hover:bg-indigo-700 rounded text-xs transition-colors flex items-center justify-center"
            >
              <i class="fas fa-sync mr-2"></i> Refresh Token
            </button>
          </div>
        </div>
      {:else}
        <!-- Collapsed mobile footer -->
        <button
          on:click={togglePanel}
          class="w-full p-3 flex items-center justify-center gap-2 text-yellow-400 hover:text-yellow-300 text-sm font-bold transition-colors border-t border-gray-600"
        >
          <i class="fas fa-chevron-up"></i>
          🛠️ Dev Testing Panel
        </button>
      {/if}
    </div>
  {/if}
{/if}