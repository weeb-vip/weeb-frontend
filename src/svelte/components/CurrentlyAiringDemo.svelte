<script lang="ts">
  import { onMount } from 'svelte';
  import { createQuery, createMutation, QueryClient } from '@tanstack/svelte-query';
  import AnimeCard from './AnimeCard.svelte';
  import AnimeStatusDropdown from './AnimeStatusDropdown.svelte';
  import { initializeQueryClient } from '../services/query-client';
  import { ensureConfigLoaded } from '../../services/config-loader';
  import { AuthStorage } from '../../utils/auth-storage';
  import { GraphQLClient } from 'graphql-request';

  let queryClient: QueryClient | null = null;
  let isClient = false;
  let config: any = null;

  // GraphQL queries
  const getCurrentlyAiringQuery = `
    query CurrentlyAiring {
      currentlyAiring {
        sunday {
          anime {
            id
            title
            description
            image
            episodes
            duration
            year
            status
          }
          nextEpisode {
            episode
            airDate
          }
        }
        monday {
          anime {
            id
            title
            description
            image
            episodes
            duration
            year
            status
          }
          nextEpisode {
            episode
            airDate
          }
        }
        tuesday {
          anime {
            id
            title
            description
            image
            episodes
            duration
            year
            status
          }
          nextEpisode {
            episode
            airDate
          }
        }
        wednesday {
          anime {
            id
            title
            description
            image
            episodes
            duration
            year
            status
          }
          nextEpisode {
            episode
            airDate
          }
        }
        thursday {
          anime {
            id
            title
            description
            image
            episodes
            duration
            year
            status
          }
          nextEpisode {
            episode
            airDate
          }
        }
        friday {
          anime {
            id
            title
            description
            image
            episodes
            duration
            year
            status
          }
          nextEpisode {
            episode
            airDate
          }
        }
        saturday {
          anime {
            id
            title
            description
            image
            episodes
            duration
            year
            status
          }
          nextEpisode {
            episode
            airDate
          }
        }
      }
    }
  `;

  const upsertAnimeQuery = `
    mutation AddAnime($input: UserAnimeInput!) {
      AddAnime(input: $input) {
        id
        status
      }
    }
  `;

  const deleteAnimeQuery = `
    mutation DeleteAnime($input: String!) {
      DeleteAnime(input: $input)
    }
  `;

  onMount(async () => {
    try {
      config = await ensureConfigLoaded();
      queryClient = initializeQueryClient();
      isClient = true;
    } catch (error) {
      console.warn('Failed to initialize:', error);
      isClient = true;
    }
  });

  // Create authenticated GraphQL client
  function createAuthClient() {
    const token = AuthStorage.getAuthToken();
    if (!config?.graphql_host) {
      throw new Error('Config not loaded');
    }
    return new GraphQLClient(config.graphql_host, {
      headers: {
        Authorization: token ? `Bearer ${token}` : ''
      }
    });
  }

  // Fetch currently airing anime
  $: currentlyAiringQuery = isClient && queryClient && config ? createQuery({
    queryKey: ['currently-airing'],
    queryFn: async () => {
      try {
        const client = createAuthClient();
        const data = await client.request(getCurrentlyAiringQuery);
        return data.currentlyAiring;
      } catch (error) {
        console.error('Failed to fetch currently airing:', error);
        throw error;
      }
    },
    enabled: isClient && !!config
  }, queryClient) : null;

  // Mutation for updating anime status
  $: updateAnimeMutation = isClient && queryClient && config ? createMutation({
    mutationFn: async ({ animeId, status }: { animeId: string; status: string }) => {
      const client = createAuthClient();
      const data = await client.request(upsertAnimeQuery, {
        input: { animeID: animeId, status }
      });
      return data.AddAnime;
    },
    onSuccess: () => {
      // Invalidate and refetch
      if (queryClient) {
        queryClient.invalidateQueries({ queryKey: ['currently-airing'] });
      }
    }
  }, queryClient) : null;

  // Mutation for deleting anime
  $: deleteAnimeMutation = isClient && queryClient && config ? createMutation({
    mutationFn: async (animeId: string) => {
      const client = createAuthClient();
      const data = await client.request(deleteAnimeQuery, { input: animeId });
      return data.DeleteAnime;
    },
    onSuccess: () => {
      // Invalidate and refetch
      if (queryClient) {
        queryClient.invalidateQueries({ queryKey: ['currently-airing'] });
      }
    }
  }, queryClient) : null;

  function handleStatusChange(event: CustomEvent) {
    if (!updateAnimeMutation) return;
    const { animeId, status } = event.detail;
    $updateAnimeMutation.mutate({ animeId, status });
  }

  function handleDelete(event: CustomEvent) {
    if (!deleteAnimeMutation) return;
    const { animeId } = event.detail;
    $deleteAnimeMutation.mutate(animeId);
  }

  // Get all anime from all days
  function getAllAnime(data: any) {
    if (!data) return [];
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const allAnime = [];

    for (const day of days) {
      if (data[day] && Array.isArray(data[day])) {
        for (const item of data[day]) {
          if (item.anime) {
            allAnime.push({
              ...item.anime,
              nextEpisode: item.nextEpisode,
              day
            });
          }
        }
      }
    }

    return allAnime;
  }

  $: animeList = currentlyAiringQuery ? getAllAnime($currentlyAiringQuery?.data) : [];
</script>

<div class="space-y-6">
  {#if !isClient || !queryClient}
    <!-- Loading skeleton -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {#each Array(6) as _}
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-4 animate-pulse">
          <div class="w-full h-48 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
          <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
          <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
        </div>
      {/each}
    </div>
  {:else if $currentlyAiringQuery?.isLoading}
    <!-- Loading state -->
    <div class="text-center py-8">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      <p class="mt-2 text-gray-600 dark:text-gray-400">Loading currently airing anime...</p>
    </div>
  {:else if $currentlyAiringQuery?.error}
    <!-- Error state -->
    <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
      <p class="text-red-600 dark:text-red-400">
        <i class="fas fa-exclamation-triangle mr-2"></i>
        Failed to load anime: {$currentlyAiringQuery.error.message}
      </p>
      <button
        on:click={() => $currentlyAiringQuery?.refetch()}
        class="mt-2 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
      >
        Try Again
      </button>
    </div>
  {:else if animeList.length === 0}
    <!-- Empty state -->
    <div class="text-center py-12">
      <i class="fas fa-tv text-6xl text-gray-400 mb-4"></i>
      <p class="text-gray-600 dark:text-gray-400 text-lg">No currently airing anime found</p>
    </div>
  {:else}
    <!-- Display anime -->
    <div class="mb-4 flex justify-between items-center">
      <p class="text-gray-600 dark:text-gray-400">
        Found {animeList.length} currently airing anime
      </p>
      <button
        on:click={() => $currentlyAiringQuery?.refetch()}
        class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        disabled={$currentlyAiringQuery?.isFetching}
      >
        {#if $currentlyAiringQuery?.isFetching}
          <i class="fas fa-sync fa-spin mr-2"></i>
        {:else}
          <i class="fas fa-sync mr-2"></i>
        {/if}
        Refresh
      </button>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {#each animeList as anime (anime.id)}
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          <AnimeCard
            style="detail"
            title={anime.title}
            description={anime.description || ''}
            episodes={anime.episodes || 'Unknown'}
            episodeLength={anime.duration ? `${anime.duration} min` : 'Unknown'}
            year={anime.year || 'Unknown'}
            image={anime.image}
            id={anime.id}
            airTime={anime.nextEpisode?.airDate ? {
              show: true,
              text: `Episode ${anime.nextEpisode.episode} - ${anime.day}`,
              variant: 'scheduled'
            } : undefined}
            entry={anime.status ? { status: anime.status } : null}
          >
            <div slot="options" class="flex gap-2 w-full">
              <AnimeStatusDropdown
                entry={{
                  id: anime.id,
                  anime: { id: anime.id },
                  status: anime.status || 'PLANTOWATCH'
                }}
                variant="compact"
                on:statusChange={handleStatusChange}
                on:delete={handleDelete}
              />
              {#if $updateAnimeMutation?.isPending && $updateAnimeMutation?.variables?.animeId === anime.id}
                <span class="text-sm text-gray-500 dark:text-gray-400">
                  <i class="fas fa-spinner fa-spin"></i> Updating...
                </span>
              {/if}
              {#if $deleteAnimeMutation?.isPending && $deleteAnimeMutation?.variables === anime.id}
                <span class="text-sm text-red-500 dark:text-red-400">
                  <i class="fas fa-spinner fa-spin"></i> Removing...
                </span>
              {/if}
            </div>
          </AnimeCard>
        </div>
      {/each}
    </div>
  {/if}

  {#if $updateAnimeMutation?.isError}
    <div class="fixed bottom-4 right-4 bg-red-500 text-white px-4 py-2 rounded shadow-lg">
      <i class="fas fa-exclamation-circle mr-2"></i>
      Failed to update status
    </div>
  {/if}

  {#if $deleteAnimeMutation?.isError}
    <div class="fixed bottom-4 right-4 bg-red-500 text-white px-4 py-2 rounded shadow-lg">
      <i class="fas fa-exclamation-circle mr-2"></i>
      Failed to remove anime
    </div>
  {/if}

  {#if $updateAnimeMutation?.isSuccess}
    <div class="fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg">
      <i class="fas fa-check-circle mr-2"></i>
      Status updated successfully
    </div>
  {/if}
</div>