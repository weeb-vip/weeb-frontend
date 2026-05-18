// Astro navigation utilities with View Transitions support

// Create navigation loading indicator
function showNavigationLoading() {
  // Remove any existing loader
  const existingLoader = document.getElementById('navigation-loader');
  if (existingLoader) existingLoader.remove();

  // Create new loader
  const loader = document.createElement('div');
  loader.id = 'navigation-loader';
  loader.className = 'fixed top-0 left-0 w-full h-1 bg-blue-500 z-[100] transition-all duration-300';
  loader.innerHTML = `
    <div class="h-full bg-blue-600 animate-pulse" style="animation: loading-progress 1s ease-out forwards"></div>
  `;

  // Add CSS animation if not already present
  if (!document.getElementById('navigation-loader-styles')) {
    const style = document.createElement('style');
    style.id = 'navigation-loader-styles';
    style.textContent = `
      @keyframes loading-progress {
        0% { width: 0%; }
        50% { width: 70%; }
        100% { width: 90%; }
      }

      body.navigating {
        cursor: wait !important;
      }

      body.navigating * {
        pointer-events: none !important;
      }

      body.navigating a, body.navigating button {
        opacity: 0.7;
        transition: opacity 0.2s;
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(loader);
  document.body.classList.add('navigating');
}

function hideNavigationLoading() {
  const loader = document.getElementById('navigation-loader');
  if (loader) {
    loader.style.width = '100%';
    setTimeout(() => loader.remove(), 200);
  }
  document.body.classList.remove('navigating');
}

export function navigateWithTransition(url: string) {
  // Check if we're in the browser and View Transitions are supported
  if (typeof window === 'undefined') return;

  // Show immediate feedback
  showNavigationLoading();

  // Use Astro's navigate function if available (from View Transitions)
  if ('astroNavigate' in window) {
    (window as any).astroNavigate(url);
    // Astro will handle hiding the loader when page loads
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