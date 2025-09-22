/**
 * Analytics utilities for PostHog tracking
 *
 * Usage:
 * - trackEvent('anime_added', { anime_id: '123', title: 'Attack on Titan' })
 * - trackEvent('list_updated', { list_type: 'watching', count: 5 })
 */

declare global {
  interface Window {
    posthog?: {
      capture: (eventName: string, properties?: Record<string, any>) => void;
      identify: (userId: string, userProperties?: Record<string, any>) => void;
    };
  }
}

/**
 * Track custom events in PostHog Analytics
 * @param eventName - The name of the event (e.g., 'anime_added', 'list_updated')
 * @param eventData - Optional data to send with the event
 */
export function trackEvent(eventName: string, eventData?: Record<string, any>) {
  if (typeof window !== 'undefined' && window.posthog) {
    try {
      window.posthog.capture(eventName, eventData);
      console.log('📊 Analytics event tracked:', eventName, eventData);
    } catch (error) {
      console.warn('📊 Analytics tracking failed:', error);
    }
  } else {
    console.warn('📊 PostHog analytics not available');
  }
}

/**
 * Pre-defined event tracking functions for common anime actions
 */
export const analytics = {
  // Anime interactions
  animeViewed: (animeId: string, title: string) =>
    trackEvent('anime_viewed', { anime_id: animeId, title }),

  animeAddedToList: (animeId: string, title: string, listType: string) =>
    trackEvent('anime_added_to_list', { anime_id: animeId, title, list_type: listType }),

  animeRemovedFromList: (animeId: string, title: string, listType: string) =>
    trackEvent('anime_removed_from_list', { anime_id: animeId, title, list_type: listType }),

  animeRated: (animeId: string, title: string, rating: number) =>
    trackEvent('anime_rated', { anime_id: animeId, title, rating }),

  // Search and discovery
  searchPerformed: (query: string, resultsCount: number) =>
    trackEvent('search_performed', { query, results_count: resultsCount }),

  seasonalAnimeViewed: (season: string, year: number) =>
    trackEvent('seasonal_anime_viewed', { season, year }),

  // User engagement
  profileViewed: (userId?: string) =>
    trackEvent('profile_viewed', userId ? { user_id: userId } : undefined),

  listShared: (listType: string, animeCount: number) =>
    trackEvent('list_shared', { list_type: listType, anime_count: animeCount }),

  // Navigation
  pageViewed: (pageName: string, additionalData?: Record<string, any>) =>
    trackEvent('page_viewed', { page_name: pageName, ...additionalData }),

  // Errors and performance
  errorOccurred: (errorType: string, errorMessage: string) =>
    trackEvent('error_occurred', { error_type: errorType, error_message: errorMessage }),
};

/**
 * Initialize analytics tracking
 * Call this after the page loads to ensure PostHog is available
 */
export function initializeAnalytics() {
  if (typeof window !== 'undefined') {
    // Wait for PostHog to be available
    const checkPostHog = () => {
      if (window.posthog) {
        console.log('📊 PostHog analytics initialized');
        return true;
      }
      return false;
    };

    // Check immediately
    if (!checkPostHog()) {
      // If not available, check every 100ms for up to 5 seconds
      let attempts = 0;
      const maxAttempts = 50;

      const interval = setInterval(() => {
        attempts++;
        if (checkPostHog() || attempts >= maxAttempts) {
          clearInterval(interval);
          if (attempts >= maxAttempts) {
            console.warn('📊 PostHog analytics failed to initialize after 5 seconds');
          }
        }
      }, 100);
    }
  }
}