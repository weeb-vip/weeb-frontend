// Handle iOS/Android swipe-back navigation smoothly
import debug from './debug';

interface NavigationState {
  scrollPosition: number;
  timestamp: number;
  url: string;
  formData?: Record<string, any>;
}

class SwipeNavigationHandler {
  private static instance: SwipeNavigationHandler;
  private navigationState: Map<string, NavigationState> = new Map();
  private isRestoringFromCache = false;

  private constructor() {
    this.initializeEventListeners();
  }

  public static getInstance(): SwipeNavigationHandler {
    if (!SwipeNavigationHandler.instance) {
      SwipeNavigationHandler.instance = new SwipeNavigationHandler();
    }
    return SwipeNavigationHandler.instance;
  }

  private initializeEventListeners() {
    if (typeof window === 'undefined') return;

    // Save state before navigation
    window.addEventListener('pagehide', this.handlePageHide.bind(this));

    // Restore state after navigation back
    window.addEventListener('pageshow', this.handlePageShow.bind(this));

    // Handle browser back/forward navigation
    window.addEventListener('popstate', this.handlePopState.bind(this));

    // Save scroll position periodically
    let scrollTimer: NodeJS.Timeout;
    window.addEventListener('scroll', () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        this.saveCurrentState();
      }, 100);
    });

    // Save state on visibility change (app switching)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.saveCurrentState();
      }
    });
  }

  private handlePageHide(event: PageTransitionEvent) {
    debug.log('Page hide event - persisted:', event.persisted);

    // Always save state when page is hidden
    this.saveCurrentState();

    // If page is being persisted in bfcache, mark it for smooth restoration
    if (event.persisted) {
      sessionStorage.setItem('bfcache-persisted', 'true');
    }
  }

  private handlePageShow(event: PageTransitionEvent) {
    const wasPersisted = event.persisted;
    const wasMarkedPersisted = sessionStorage.getItem('bfcache-persisted') === 'true';

    debug.log('Page show event - persisted:', wasPersisted, 'was marked:', wasMarkedPersisted);

    if (wasPersisted || wasMarkedPersisted) {
      this.isRestoringFromCache = true;

      // Clean up the marker
      sessionStorage.removeItem('bfcache-persisted');

      // Restore state after a brief delay to ensure DOM is ready
      setTimeout(() => {
        this.restoreCurrentState();
        this.isRestoringFromCache = false;

        // Dispatch custom event to notify components
        window.dispatchEvent(new CustomEvent('swipe-navigation-restored', {
          detail: { fromCache: true }
        }));
      }, 50);
    }
  }

  private handlePopState(event: PopStateEvent) {
    debug.log('Popstate event:', event.state);

    // Short delay to allow state restoration
    setTimeout(() => {
      this.restoreCurrentState();

      // Dispatch custom event
      window.dispatchEvent(new CustomEvent('swipe-navigation-restored', {
        detail: { fromPopstate: true, state: event.state }
      }));
    }, 100);
  }

  private saveCurrentState() {
    if (typeof window === 'undefined') return;

    const state: NavigationState = {
      scrollPosition: window.scrollY,
      timestamp: Date.now(),
      url: window.location.href
    };

    // Save form data if any forms are present
    const forms = document.querySelectorAll('form');
    if (forms.length > 0) {
      const formData: Record<string, any> = {};
      forms.forEach((form, index) => {
        const data = new FormData(form);
        const formObject: Record<string, any> = {};
        for (const [key, value] of data.entries()) {
          formObject[key] = value;
        }
        if (Object.keys(formObject).length > 0) {
          formData[`form_${index}`] = formObject;
        }
      });
      if (Object.keys(formData).length > 0) {
        state.formData = formData;
      }
    }

    this.navigationState.set(window.location.pathname, state);

    // Also save to sessionStorage as backup
    try {
      sessionStorage.setItem(`nav_state_${window.location.pathname}`, JSON.stringify(state));
    } catch (e) {
      debug.warn('Failed to save navigation state to sessionStorage:', e);
    }
  }

  private restoreCurrentState() {
    if (typeof window === 'undefined') return;

    const pathname = window.location.pathname;
    let state = this.navigationState.get(pathname);

    // Try sessionStorage if not in memory
    if (!state) {
      try {
        const stored = sessionStorage.getItem(`nav_state_${pathname}`);
        if (stored) {
          state = JSON.parse(stored);
        }
      } catch (e) {
        debug.warn('Failed to restore navigation state from sessionStorage:', e);
      }
    }

    if (!state) return;

    debug.log('Restoring navigation state:', state);

    // Restore scroll position
    if (typeof state.scrollPosition === 'number') {
      // Use requestAnimationFrame to ensure smooth scrolling after layout
      requestAnimationFrame(() => {
        window.scrollTo({
          top: state.scrollPosition,
          behavior: 'instant' // No animation for back navigation
        });
      });
    }

    // Restore form data if available
    if (state.formData) {
      Object.entries(state.formData).forEach(([formKey, formData]) => {
        const formIndex = parseInt(formKey.replace('form_', ''));
        const form = document.forms[formIndex];
        if (form) {
          Object.entries(formData as Record<string, any>).forEach(([fieldName, value]) => {
            const field = form.querySelector(`[name="${fieldName}"]`) as HTMLInputElement;
            if (field) {
              field.value = String(value);
            }
          });
        }
      });
    }
  }

  // Public method to check if currently restoring from cache
  public isRestoring(): boolean {
    return this.isRestoringFromCache;
  }

  // Public method to manually save state (useful before programmatic navigation)
  public saveState(): void {
    this.saveCurrentState();
  }

  // Public method to clean up old states (call periodically)
  public cleanupOldStates(maxAge: number = 30 * 60 * 1000): void { // 30 minutes default
    const now = Date.now();
    for (const [key, state] of this.navigationState.entries()) {
      if (now - state.timestamp > maxAge) {
        this.navigationState.delete(key);
        sessionStorage.removeItem(`nav_state_${key}`);
      }
    }
  }
}

// Initialize singleton
export const swipeNavigation = SwipeNavigationHandler.getInstance();

// Helper function to use in components that need to know about navigation state
export function useSwipeNavigation() {
  return {
    isRestoring: () => swipeNavigation.isRestoring(),
    saveState: () => swipeNavigation.saveState(),
    onRestored: (callback: (detail: any) => void) => {
      const handler = (event: CustomEvent) => callback(event.detail);
      window.addEventListener('swipe-navigation-restored', handler as EventListener);
      return () => window.removeEventListener('swipe-navigation-restored', handler as EventListener);
    }
  };
}