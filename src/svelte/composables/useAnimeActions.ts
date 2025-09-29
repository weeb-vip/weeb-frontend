import { writable } from 'svelte/store';
import { useAddAnimeWithToast, useDeleteAnimeWithToast } from '../utils/anime-actions';

export interface AnimeActionStatus {
  [key: string]: 'idle' | 'loading' | 'success' | 'error';
}

export function useAnimeActions() {
  // Status tracking store
  const statusStore = writable<AnimeActionStatus>({});

  // Initialize mutations (returns Svelte stores)
  const addAnimeMutation = useAddAnimeWithToast();
  const deleteAnimeMutation = useDeleteAnimeWithToast();

  // Helper to update status
  function updateStatus(key: string, status: 'idle' | 'loading' | 'success' | 'error') {
    statusStore.update(statuses => ({ ...statuses, [key]: status }));
  }

  // Helper to clear status after delay
  function clearStatusAfterDelay(key: string, delay: number = 1000) {
    setTimeout(() => {
      updateStatus(key, 'idle');
    }, delay);
  }

  // Simple helpers that return the stores directly for component usage
  function getAddMutation() {
    return addAnimeMutation;
  }

  function getDeleteMutation() {
    return deleteAnimeMutation;
  }

  return {
    // Stores
    statusStore,

    // Mutation getters
    getAddMutation,
    getDeleteMutation,

    // Utilities
    updateStatus,
    clearStatusAfterDelay
  };
}