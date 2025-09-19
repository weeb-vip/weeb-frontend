import { toastStore, type ToastData } from '../stores/toast';

// Utility functions to show different types of toasts
export const showToast = {
  success: (title: string, message: string, options?: Partial<Omit<ToastData, 'id' | 'type' | 'title' | 'message'>>) => {
    const isMobile = typeof window !== 'undefined' ? window.innerWidth < 1024 : false;
    toastStore.showToast({
      type: 'success',
      title,
      message,
      ...options
    }, isMobile);
  },

  info: (title: string, message: string, options?: Partial<Omit<ToastData, 'id' | 'type' | 'title' | 'message'>>) => {
    const isMobile = typeof window !== 'undefined' ? window.innerWidth < 1024 : false;
    toastStore.showToast({
      type: 'info',
      title,
      message,
      ...options
    }, isMobile);
  },

  warning: (title: string, message: string, options?: Partial<Omit<ToastData, 'id' | 'type' | 'title' | 'message'>>) => {
    const isMobile = typeof window !== 'undefined' ? window.innerWidth < 1024 : false;
    toastStore.showToast({
      type: 'warning',
      title,
      message,
      ...options
    }, isMobile);
  },

  // Anime-specific toast with navigation
  animeAdded: (animeTitle: string, anime: ToastData['anime']) => {
    const isMobile = typeof window !== 'undefined' ? window.innerWidth < 1024 : false;
    toastStore.showToast({
      type: 'success',
      title: 'Added to List',
      message: `${animeTitle} has been added to your watchlist`,
      anime,
      duration: 8000 // Longer duration for anime toasts
    }, isMobile);
  },

  animeRemoved: (animeTitle: string) => {
    const isMobile = typeof window !== 'undefined' ? window.innerWidth < 1024 : false;
    toastStore.showToast({
      type: 'info',
      title: 'Removed from List',
      message: `${animeTitle} has been removed from your watchlist`,
      duration: 5000
    }, isMobile);
  },

  animeStatusChanged: (animeTitle: string, newStatus: string, anime: ToastData['anime']) => {
    const isMobile = typeof window !== 'undefined' ? window.innerWidth < 1024 : false;
    const statusLabels: Record<string, string> = {
      'COMPLETED': 'Completed',
      'DROPPED': 'Dropped',
      'ONHOLD': 'On Hold',
      'PLANTOWATCH': 'Watchlist',
      'WATCHING': 'Watching',
    };

    toastStore.showToast({
      type: 'success',
      title: 'Status Updated',
      message: `${animeTitle} moved to ${statusLabels[newStatus] || newStatus}`,
      anime,
      duration: 6000
    }, isMobile);
  }
};

export { toastStore };