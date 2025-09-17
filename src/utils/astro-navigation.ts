// Astro navigation utilities with View Transitions support

export function navigateWithTransition(url: string) {
  // Check if we're in the browser and View Transitions are supported
  if (typeof window === 'undefined') return;

  // Use Astro's navigate function if available (from View Transitions)
  if ('astroNavigate' in window) {
    (window as any).astroNavigate(url);
    return;
  }

  // Fallback: Try to use startViewTransition if available
  if ('startViewTransition' in document) {
    document.startViewTransition(() => {
      window.location.href = url;
    });
    return;
  }

  // Final fallback: regular navigation
  window.location.href = url;
}

export function useAstroNavigation() {
  return {
    navigate: navigateWithTransition
  };
}