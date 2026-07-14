// Global error toasts + navigation feedback, ported from the inline
// scripts in SvelteLayout.astro. Navigation events are now driven by
// SvelteKit's beforeNavigate/afterNavigate in +layout.svelte.

let progressTimer: ReturnType<typeof setInterval> | null = null;
let progressTimeout: ReturnType<typeof setTimeout> | null = null;
let isNavigating = false;

export function showInstantFeedback() {
  document.body.style.cursor = 'wait';
  isNavigating = true;

  const progressBar = document.getElementById('navigation-progress');
  progressTimeout = setTimeout(() => {
    if (isNavigating && progressBar) {
      progressBar.style.opacity = '1';
      progressBar.style.transform = 'translateY(0)';
      progressBar.style.width = '0%';

      let progress = 0;
      progressTimer = setInterval(() => {
        progress += Math.random() * 15;
        if (progress > 90) progress = 90;
        progressBar.style.width = progress + '%';
      }, 100);
    }
  }, 100);
}

export function hideNavigationFeedback() {
  document.body.style.cursor = '';

  if (progressTimeout) {
    clearTimeout(progressTimeout);
    progressTimeout = null;
  }

  const progressBar = document.getElementById('navigation-progress');
  if (progressBar) {
    progressBar.style.width = '100%';
    setTimeout(() => {
      progressBar.style.opacity = '0';
      progressBar.style.transform = 'translateY(-100%)';
    }, 200);
  }

  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = null;
  }

  isNavigating = false;
}

function showErrorToast(message: string, isAuthError = false) {
  const w = window as any;
  const isUserLoggedIn = w.loggedInStoreValue?.isLoggedIn || false;
  const shouldShowLoginOption = (isAuthError || message.toLowerCase().includes('log in')) && !isUserLoggedIn;

  const toastApi = w.globalToast || w.toast || (w.sonner && w.sonner.toast);
  if (toastApi) {
    if (shouldShowLoginOption) {
      toastApi.error(message, {
        action: {
          label: 'Login',
          onClick: () => w.loginModalStore?.openLogin()
        },
        duration: 8000
      });
      if (w.globalToast?.info) {
        setTimeout(() => {
          w.globalToast.info('Or create a new account', {
            action: {
              label: 'Register',
              onClick: () => w.loginModalStore?.openRegister()
            },
            duration: 8000
          });
        }, 500);
      }
    } else {
      toastApi.error(message);
    }
    return;
  }

  // Fallback: DOM-built error notification
  console.error('Error:', message);
  const errorDiv = document.createElement('div');
  errorDiv.className = 'fixed top-24 right-4 bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg z-50 max-w-sm border border-red-500';

  const iconSvg = '<svg class="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path></svg>';

  if (shouldShowLoginOption) {
    errorDiv.innerHTML = `
      <div class="flex flex-col gap-3">
        <div class="flex items-center gap-2">${iconSvg}<span class="text-sm font-medium"></span></div>
        <div class="flex gap-2 mt-2">
          <button class="fallback-login-btn px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-all duration-200 hover:scale-105 focus:ring-2 focus:ring-blue-300 focus:outline-none">Login</button>
          <button class="fallback-register-btn px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-md transition-all duration-200 hover:scale-105 focus:ring-2 focus:ring-green-300 focus:outline-none">Register</button>
        </div>
      </div>`;
    errorDiv.querySelector('span')!.textContent = message;
    errorDiv.querySelector('.fallback-login-btn')!.addEventListener('click', () => {
      w.loginModalStore?.openLogin();
      errorDiv.remove();
    });
    errorDiv.querySelector('.fallback-register-btn')!.addEventListener('click', () => {
      w.loginModalStore?.openRegister();
      errorDiv.remove();
    });
  } else {
    errorDiv.innerHTML = `<div class="flex items-center gap-2">${iconSvg}<span class="text-sm font-medium"></span></div>`;
    errorDiv.querySelector('span')!.textContent = message;
  }

  document.body.appendChild(errorDiv);
  const duration = shouldShowLoginOption ? 10000 : 6000;
  setTimeout(() => {
    if (errorDiv.parentNode) {
      errorDiv.style.opacity = '0';
      errorDiv.style.transform = 'translateX(100%)';
      errorDiv.style.transition = 'all 0.3s ease-out';
      setTimeout(() => errorDiv.remove(), 300);
    }
  }, duration);
}

export function initGlobalErrorHandlers() {
  const w = window as any;

  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);

    let message = 'Something went wrong. Please try again.';
    let isAuthError = false;

    if (event.reason && typeof event.reason === 'object') {
      if (event.reason.message) {
        const errorMsg = event.reason.message.toLowerCase();
        if (errorMsg.includes('network') || errorMsg.includes('fetch')) {
          message = 'Network error. Please check your connection.';
        } else if (errorMsg.includes('unauthorized') || errorMsg.includes('forbidden') || errorMsg.includes('access denied') || errorMsg.includes('authentication') || errorMsg.includes('not authenticated') || errorMsg.includes('not logged in') || errorMsg.includes('login required')) {
          message = 'Please log in to continue.';
          isAuthError = true;
        } else if (errorMsg.includes('not found')) {
          message = 'The requested item was not found.';
        } else if (event.reason.message.length < 100) {
          message = event.reason.message;
        }
      }
    } else if (typeof event.reason === 'string' && event.reason.length < 100) {
      message = event.reason;
      const lowerMsg = message.toLowerCase();
      if (lowerMsg.includes('unauthorized') || lowerMsg.includes('forbidden') || lowerMsg.includes('access denied') || lowerMsg.includes('authentication') || lowerMsg.includes('not authenticated') || lowerMsg.includes('not logged in') || lowerMsg.includes('login required')) {
        isAuthError = true;
      }
    }

    showErrorToast(message, isAuthError);
  });

  window.addEventListener('error', (event) => {
    console.error('Global error:', event.error, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      message: event.message,
      type: event.type
    });

    const errorMessage = event.message || '';
    const filename = event.filename || '';

    if (
      filename.includes('.js') ||
      filename.includes('.ts') ||
      errorMessage.includes('Failed to fetch dynamically imported module') ||
      errorMessage.includes('hydrating') ||
      errorMessage.includes('Loading chunk') ||
      errorMessage.includes('Loading CSS chunk') ||
      errorMessage.includes('ChunkLoadError') ||
      errorMessage.includes('Cannot read properties of null') ||
      errorMessage.includes('ResizeObserver') ||
      errorMessage.toLowerCase().includes('network error') ||
      errorMessage.toLowerCase().includes('fetch')
    ) {
      console.warn('Suppressed error toast for:', errorMessage);
      return;
    }

    showErrorToast('An unexpected error occurred.');
  });

  w.showErrorToast = showErrorToast;
  w.testErrorToast = () => showErrorToast('Test error message - this should appear as a toast!');
  w.testAuthErrorToast = () => showErrorToast('Please log in to add anime to your list', true);

  // Connect the toast system to svelte-sonner once it loads
  setTimeout(async () => {
    try {
      const module = await import('svelte-sonner');
      if (module.toast) {
        w.globalToast = module.toast;
      }
    } catch {
      console.log('Could not import svelte-sonner, using fallback toasts');
    }
  }, 1000);

  document.documentElement.style.scrollBehavior = 'smooth';
}

// PostHog bootstrap, ported from PostHog.astro — waits for window.config
export function initPostHogWhenConfigured() {
  const w = window as any;

  function initPostHog() {
    const config = w.config;
    if (!config || !config.posthog_api_key) {
      return;
    }

    /* eslint-disable */
    !function(t: any, e: any) { var o: any, n: any, p: any, r: any; e.__SV || (w.posthog = e, e._i = [], e.init = function(i: any, s: any, a: any) { function g(t: any, e: any) { var o = e.split('.'); 2 == o.length && (t = t[o[0]], e = o[1]), t[e] = function() { t.push([e].concat(Array.prototype.slice.call(arguments, 0))) } } (p = t.createElement('script')).type = 'text/javascript', p.crossOrigin = 'anonymous', p.async = !0, p.src = s.api_host + '/static/array.js', (r = t.getElementsByTagName('script')[0]).parentNode.insertBefore(p, r); var u = e; for (void 0 !== a ? u = e[a] = [] : a = 'posthog', u.people = u.people || [], u.toString = function(t: any) { var e = 'posthog'; return 'posthog' !== a && (e += '.' + a), t || (e += ' (stub)'), e }, u.people.toString = function() { return u.toString(1) + '.people (stub)' }, o = 'capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys getNextSurveyStep onSessionId'.split(' '), n = 0; n < o.length; n++) g(u, o[n]); e._i.push([i, s, a]) }, e.__SV = 1) }(document, w.posthog || []);
    /* eslint-enable */

    w.posthog.init(config.posthog_api_key, {
      api_host: 'https://us.i.posthog.com',
      capture_pageview: true,
      person_profiles: 'identified_only',
      opt_in_site_apps: true
    });

    // Persist toolbar enablement across sessions
    const originalLoadToolbar = w.posthog.loadToolbar;
    w.posthog.loadToolbar = function(params: any) {
      localStorage.setItem('posthog_toolbar_enabled', 'true');
      if (params) {
        localStorage.setItem('posthog_toolbar_params', JSON.stringify(params));
      }
      return originalLoadToolbar.call(this, params);
    };

    w.disablePostHogToolbar = () => {
      localStorage.removeItem('posthog_toolbar_enabled');
      localStorage.removeItem('posthog_toolbar_params');
    };

    setTimeout(() => {
      const toolbarEnabled = localStorage.getItem('posthog_toolbar_enabled');
      const savedParams = localStorage.getItem('posthog_toolbar_params');
      if (toolbarEnabled === 'true') {
        if (savedParams) {
          try {
            w.posthog.loadToolbar(JSON.parse(savedParams));
          } catch {
            w.posthog.loadToolbar();
          }
        } else {
          w.posthog.loadToolbar();
        }
      }
    }, 1000);
  }

  if (w.config) {
    initPostHog();
  } else {
    document.addEventListener('config-loaded', initPostHog, { once: true });
    let attempts = 0;
    const checkConfig = setInterval(() => {
      attempts++;
      if (w.config) {
        clearInterval(checkConfig);
        initPostHog();
      } else if (attempts > 50) {
        clearInterval(checkConfig);
      }
    }, 100);
  }
}
