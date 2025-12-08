<script lang="ts">
  import { onMount } from 'svelte';
  import { createQuery } from '@tanstack/svelte-query';
  import { fetchUserAnimes } from '../../services/queries';
  import { useAddAnimeWithToast, useDeleteAnimeWithToast } from '../utils/anime-actions';
  import { Status, type UserAnime } from '../../gql/graphql';
  import { GetImageFromAnime, getYearUTC } from '../../services/utils';
  import { navigateWithTransition } from '../../utils/astro-navigation';
  import { initializeQueryClient } from '../services/query-client';
  import AnimeCard from './AnimeCard.svelte';
  import AnimeStatusDropdown from './AnimeStatusDropdown.svelte';
  import { preferencesStore, getAnimeTitle } from '../stores/preferences';

  // Initialize query client
  const queryClient = initializeQueryClient();

  // Subscribe to preferences for title language
  $: preferences = $preferencesStore;

  const PAGE_SIZE = 16;

  let mounted = false;
  let selectedStatus = Status.Plantowatch;
  let page = 0;

  // Status labels
  const statusLabels: Record<Status, string> = {
    [Status.Completed]: "Completed",
    [Status.Dropped]: "Dropped",
    [Status.Onhold]: "On Hold",
    [Status.Plantowatch]: "Plan to Watch",
    [Status.Watching]: "Watching"
  };

  // Client-side only queries and mutations
  let userAnimesQuery: any;
  let upsertAnimeMutation: any;
  let deleteAnimeMutation: any;

  // Reactive query input
  $: queryInput = {
    status: selectedStatus,
    limit: PAGE_SIZE,
    page: page + 1, // Shift from 0-based to 1-based
  };

  onMount(() => {
    mounted = true;
  });

  // Create the query and mutations reactively
  $: if (mounted) {
    userAnimesQuery = createQuery(
      fetchUserAnimes({ input: queryInput }),
      queryClient
    );

    // Use consolidated mutations with toast handling
    upsertAnimeMutation = useAddAnimeWithToast();
    deleteAnimeMutation = useDeleteAnimeWithToast();

    // Extend mutations with custom query invalidation for user animes
    const originalUpsertMutate = upsertAnimeMutation.mutate;
    upsertAnimeMutation.mutate = (variables, options = {}) => {
      const originalOnSuccess = options.onSuccess;
      options.onSuccess = (data, vars) => {
        // Invalidate user animes query to update the list
        queryClient.invalidateQueries({ queryKey: ['user-animes'] });
        if (originalOnSuccess) originalOnSuccess(data, vars);
      };
      return originalUpsertMutate(variables, options);
    };

    const originalDeleteMutate = deleteAnimeMutation.mutate;
    deleteAnimeMutation.mutate = (variables, options = {}) => {
      const originalOnSuccess = options.onSuccess;
      options.onSuccess = (data, vars) => {
        // Invalidate user animes query to update the list
        queryClient.invalidateQueries({ queryKey: ['user-animes'] });
        if (originalOnSuccess) originalOnSuccess(data, vars);
      };
      return originalDeleteMutate(variables, options);
    };
  }

  // Computed values
  $: userAnimes = userAnimesQuery ? ($userAnimesQuery.data?.animes || []) : [];
  $: total = userAnimesQuery ? ($userAnimesQuery.data?.total || 0) : 0;
  $: totalPages = Math.ceil(total / PAGE_SIZE);
  $: isLoading = userAnimesQuery ? $userAnimesQuery.isLoading : true;

  function updateURL() {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('status', selectedStatus);
      if (page > 0) {
        url.searchParams.set('page', (page + 1).toString()); // Convert to 1-based for URL
      } else {
        url.searchParams.delete('page');
      }
      window.history.pushState({}, '', url.toString());
    }
  }

  function handleStatusChange(status: Status) {
    selectedStatus = status;
    page = 0;
    updateURL();
  }

  function handlePreviousPage() {
    page = Math.max(page - 1, 0);
    updateURL();
  }

  function handleNextPage() {
    page = Math.min(page + 1, totalPages - 1);
    updateURL();
  }

  function navigateToAnime(animeId: string) {
    navigateWithTransition(`/show/${animeId}`);
  }

  function handleDropdownStatusChange(event: CustomEvent) {
    const { animeId, status } = event.detail;
    if (upsertAnimeMutation) {
      $upsertAnimeMutation.mutate({ input: { animeID: animeId, status } });
    }
  }

  function handleDelete(event: CustomEvent) {
    const { animeId } = event.detail;
    if (deleteAnimeMutation) {
      $deleteAnimeMutation.mutate(animeId);
    }
  }

  function readStateFromURL() {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);

      // Set status from URL
      const statusParam = searchParams.get('status');
      if (statusParam && Object.values(Status).includes(statusParam as Status)) {
        selectedStatus = statusParam as Status;
      }

      // Set page from URL (convert from 1-based to 0-based)
      const pageParam = searchParams.get('page');
      if (pageParam) {
        const pageNumber = parseInt(pageParam, 10);
        if (!isNaN(pageNumber) && pageNumber > 0) {
          page = pageNumber - 1; // Convert from 1-based to 0-based
        }
      } else {
        page = 0; // Reset to first page if no page param
      }
    }
  }

  // Get URL parameters on mount to set initial status and page
  onMount(() => {
    readStateFromURL();

    // Listen for browser back/forward navigation
    const handlePopState = () => {
      readStateFromURL();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', handlePopState);

      // Cleanup on component destroy
      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    }
  });
</script>

{#if !mounted || isLoading}
  <!-- Loading skeleton -->
  <div class="flex flex-col space-y-6 max-w-screen-2xl mx-auto px-4">
    <div class="flex flex-wrap gap-2 py-4">
      {#each Array(5) as _}
        <div class="h-10 w-24 bg-gray-300 dark:bg-gray-600 rounded-full animate-pulse"></div>
      {/each}
    </div>
    <div>
      <div class="h-8 bg-gray-300 dark:bg-gray-600 rounded w-48 mb-4 animate-pulse"></div>
      <div class="w-full lg:w-fit grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-x-4 gap-y-6 py-4">
        {#each Array(8) as _}
          <div class="bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse h-64"></div>
        {/each}
      </div>
    </div>
  </div>
{:else}
  <div class="flex flex-col space-y-6 max-w-screen-2xl mx-auto px-4">
    <!-- Status Filter Buttons -->
    <div class="flex flex-wrap gap-2 py-4">
      {#each Object.values(Status) as status}
        <button
          on:click={() => handleStatusChange(status)}
          class="px-4 py-2 rounded-full text-sm border transition-colors duration-300 {selectedStatus === status
            ? 'bg-blue-600 text-white border-blue-600'
            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'}"
        >
          {statusLabels[status]}
        </button>
      {/each}
    </div>

    <!-- Anime List -->
    <div>
      <h2 class="text-xl font-semibold capitalize mb-4 text-gray-900 dark:text-gray-100">
        {statusLabels[selectedStatus]}
      </h2>

      {#if userAnimes.length === 0}
        <!-- Empty state -->
        <div class="text-center py-12">
          <div class="text-6xl mb-4">📺</div>
          <h3 class="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            No anime in {statusLabels[selectedStatus].toLowerCase()}
          </h3>
          <p class="text-gray-600 dark:text-gray-400 mb-6">
            Start building your anime list by discovering new shows.
          </p>
          <a
            href="/"
            class="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors"
          >
            Explore Anime →
          </a>
        </div>
      {:else}
        <!-- Anime Grid -->
        <div class="w-full lg:w-fit grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-8 gap-x-4 gap-y-6 py-4 justify-center">
          {#each userAnimes as entry}
            <AnimeCard
              style="detail"
              id={entry.anime?.id}
              title={getAnimeTitle(entry.anime, preferences.titleLanguage)}
              description={entry.anime?.description || ""}
              episodes={entry.anime?.episodeCount || 0}
              episodeLength={entry.anime?.duration?.replace(/per.+?$|per/gm, '') || "?"}
              image={GetImageFromAnime(entry.anime)}
              className="hover:cursor-pointer"
              year={getYearUTC(entry.anime?.startDate)}
              tags={entry.anime?.tags || []}
              entry={entry}
              on:click={() => navigateToAnime(entry.anime?.id)}

            >
              <div slot="options">
                <AnimeStatusDropdown
                  {entry}
                  variant="compact"
                  on:statusChange={handleDropdownStatusChange}
                  on:delete={handleDelete}
                />
              </div>
            </AnimeCard>
          {/each}
        </div>

        <!-- Pagination -->
        {#if totalPages > 1}
          <div class="flex justify-between items-center pt-4">
            <button
              on:click={handlePreviousPage}
              disabled={page === 0}
              class="px-4 py-2 rounded bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500 disabled:opacity-50 transition-colors duration-300"
            >
              Previous
            </button>

            <span class="text-sm text-gray-600 dark:text-gray-400">
              Page {page + 1} of {totalPages}
            </span>

            <button
              on:click={handleNextPage}
              disabled={page + 1 >= totalPages}
              class="px-4 py-2 rounded bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500 disabled:opacity-50 transition-colors duration-300"
            >
              Next
            </button>
          </div>
        {/if}
      {/if}
    </div>
  </div>
{/if}
