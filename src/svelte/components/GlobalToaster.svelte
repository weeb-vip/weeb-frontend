<script>
  import { Toaster } from 'svelte-sonner';
  import { onMount } from 'svelte';

  let isMobile = false;
  let position = 'top-right';

  onMount(() => {
    const checkScreenSize = () => {
      isMobile = window.innerWidth <= 768;
      position = isMobile ? 'top-center' : 'top-right';
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);

    return () => {
      window.removeEventListener('resize', checkScreenSize);
    };
  });
</script>

<!-- Global Toaster Configuration -->
<Toaster
  {position}
  class="toaster-container"
  toastOptions={{
    duration: 6000,
    className: 'custom-toast',
    style: 'width: 20rem; max-width: 20rem; min-width: 20rem;'
  }}
/>

<style>
  :global(.toaster-container) {
    z-index: 50 !important; /* Higher z-index to appear above content */
  }

  /* Mobile positioning - let Sonner handle it, just adjust top with safe area */
  @media (max-width: 768px) {
    :global(.toaster-container) {
      top: calc(7rem + env(safe-area-inset-top, 0px)) !important;
    }
  }

  /* Desktop positioning adjustments */
  @media (min-width: 769px) {
    :global(.toaster-container) {
      top: calc(6.5rem + env(safe-area-inset-top, 0px)) !important; /* Desktop header: 96px (6rem) + small gap + safe area */
      right: 1.5rem !important;
    }
  }

  /* Force ALL Sonner toasts to be exactly 20rem width */
  :global([data-sonner-toast]) {
    width: 20rem !important;
    max-width: 20rem !important;
    min-width: 20rem !important;
  }

  /* Mobile responsive toast width */
  @media (max-width: 768px) {
    :global([data-sonner-toast]) {
      width: auto !important;
      max-width: calc(100vw - 2rem) !important;
      min-width: 16rem !important;
    }
  }

  /* Standard toasts - matching anime toast design */
  :global(.custom-toast) {
    background: rgba(255, 255, 255, 0.8) !important;
    backdrop-filter: blur(24px) !important;
    border: 1px solid rgba(229, 231, 235, 0.5) !important;
    border-radius: 9999px !important;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1) !important;
    width: 20rem !important;
    max-width: 20rem !important;
    min-width: 20rem !important;
    font-size: 0.875rem !important;
    padding: 0.875rem 1.5rem !important;
    transition: all 0.3s ease !important;
    word-wrap: break-word !important;
    overflow-wrap: break-word !important;
  }

  :global(.dark .custom-toast) {
    background: rgba(31, 41, 55, 0.8) !important;
    border-color: rgba(55, 65, 81, 0.5) !important;
    color: white !important;
  }


  /* Mobile responsive toast styling */
  @media (max-width: 768px) {
    :global(.custom-toast) {
      width: auto !important;
      max-width: calc(100vw - 2rem) !important;
      min-width: 16rem !important;
      font-size: 0.8rem !important;
      padding: 0.625rem !important;
    }
  }

  /* Custom anime toasts - fully rounded with theme colors */
  :global([data-sonner-toast][data-custom="true"]) {
    background: rgb(255, 255, 255) !important;
    border: 1px solid rgb(229, 231, 235) !important;
    border-radius: 1.5rem !important;
    padding: 0.875rem !important;
    width: 20rem !important;
    max-width: 20rem !important;
    min-width: 20rem !important;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1) !important;
    transition: background-color 0.3s ease, border-color 0.3s ease !important;
    word-wrap: break-word !important;
    overflow-wrap: break-word !important;
  }

  :global(.dark [data-sonner-toast][data-custom="true"]) {
    background: rgb(31, 41, 55) !important;
    border-color: rgb(55, 65, 81) !important;
  }

  /* Text truncation and overflow handling */
  :global(.custom-toast [data-title]) {
    max-width: 100% !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    white-space: nowrap !important;
  }

  :global(.custom-toast [data-description]) {
    max-width: 100% !important;
    overflow: hidden !important;
    display: -webkit-box !important;
    -webkit-line-clamp: 2 !important;
    -webkit-box-orient: vertical !important;
    line-height: 1.4 !important;
  }

  :global([data-sonner-toast][data-custom="true"] [data-title]) {
    max-width: 100% !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    white-space: nowrap !important;
  }

  :global([data-sonner-toast][data-custom="true"] [data-description]) {
    max-width: 100% !important;
    overflow: hidden !important;
    display: -webkit-box !important;
    -webkit-line-clamp: 2 !important;
    -webkit-box-orient: vertical !important;
    line-height: 1.4 !important;
  }


  /* Error toast specific styling - matches anime toast background */
  :global([data-sonner-toast][data-type="error"]:not(:has(.anime-toast-content))) {
    background: rgba(255, 255, 255, 0.8) !important; /* Same as anime toast bg-white/80 */
    border: 1px solid rgba(229, 231, 235, 0.5) !important; /* Neutral border like anime toast */
    border-radius: 9999px !important;
    color: rgb(127, 29, 29) !important;
    backdrop-filter: blur(24px) !important; /* Same as anime toast backdrop-blur-xl */
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1) !important;
  }

  :global(.dark [data-sonner-toast][data-type="error"]:not(:has(.anime-toast-content))) {
    background: rgba(31, 41, 55, 0.8) !important; /* Same as anime toast dark:bg-gray-800/80 */
    border: 1px solid rgba(55, 65, 81, 0.5) !important; /* Same as anime toast dark:border-gray-700/50 */
    color: rgb(248, 113, 113) !important;
  }

  /* Success toast specific styling - matches anime toast background */
  :global([data-sonner-toast][data-type="success"]:not(:has(.anime-toast-content))) {
    background: rgba(255, 255, 255, 0.8) !important; /* Same as anime toast bg-white/80 */
    border: 1px solid rgba(229, 231, 235, 0.5) !important; /* Neutral border like anime toast */
    border-radius: 9999px !important;
    color: rgb(21, 128, 61) !important;
    backdrop-filter: blur(24px) !important; /* Same as anime toast backdrop-blur-xl */
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1) !important;
  }

  :global(.dark [data-sonner-toast][data-type="success"]:not(:has(.anime-toast-content))) {
    background: rgba(31, 41, 55, 0.8) !important; /* Same as anime toast dark:bg-gray-800/80 */
    border: 1px solid rgba(55, 65, 81, 0.5) !important; /* Same as anime toast dark:border-gray-700/50 */
    color: rgb(74, 222, 128) !important;
  }

  /* Standard sonner toasts only (exclude anime custom toasts) - matches anime toast style */
  :global([data-sonner-toast]:not(:has(.anime-toast-content))) {
    background: rgba(255, 255, 255, 0.8) !important; /* Same as anime toast bg-white/80 */
    border: 1px solid rgba(229, 231, 235, 0.5) !important; /* Same as anime toast border */
    border-radius: 9999px !important;
    color: rgb(17, 24, 39) !important;
    font-size: 0.875rem !important;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1) !important;
    backdrop-filter: blur(24px) !important; /* Same as anime toast backdrop-blur-xl */
    padding: 0.875rem 1.5rem !important;
    transition: opacity 0.3s ease !important;
  }

  :global(.dark [data-sonner-toast]:not(:has(.anime-toast-content))) {
    background: rgba(31, 41, 55, 0.8) !important; /* Same as anime toast dark:bg-gray-800/80 */
    border: 1px solid rgba(55, 65, 81, 0.5) !important; /* Same as anime toast dark:border-gray-700/50 */
    color: rgb(243, 244, 246) !important;
  }

  /* Small screens - let Sonner handle positioning with safe area */
  @media (max-width: 640px) {
    :global(.toaster-container) {
      top: calc(7rem + env(safe-area-inset-top, 0px)) !important;
    }
  }

  /* Tablet (between mobile and desktop) with safe area */
  @media (min-width: 640px) and (max-width: 1023px) {
    :global(.toaster-container) {
      top: calc(5rem + env(safe-area-inset-top, 0px)) !important; /* Tablet uses mobile header layout + safe area */
    }
  }

  /* Action button styling - follows light/dark mode */
  :global([data-sonner-toast] button[data-button]) {
    background: rgb(0, 0, 0) !important; /* Black in light mode */
    color: rgb(255, 255, 255) !important; /* White text */
    border: none !important;
    border-radius: 0.5rem !important; /* rounded-lg */
    padding: 0.5rem 1rem !important; /* px-4 py-2 */
    font-size: 0.875rem !important; /* text-sm */
    font-weight: 500 !important; /* font-medium */
    transition: opacity 0.2s ease !important;
    cursor: pointer !important;
    margin-left: 0.75rem !important; /* ml-3 */
    flex-shrink: 0 !important;
    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05) !important;
  }

  :global([data-sonner-toast] button[data-button]:hover) {
    opacity: 0.8 !important; /* Subtle opacity change on hover */
  }

  :global([data-sonner-toast] button[data-button]:active) {
    opacity: 0.9 !important; /* Opacity change on active */
  }

  /* Dark mode action button styling */
  :global(.dark [data-sonner-toast] button[data-button]) {
    background: rgb(255, 255, 255) !important; /* White in dark mode */
    color: rgb(0, 0, 0) !important; /* Black text */
  }

  /* Mobile action button adjustments */
  @media (max-width: 768px) {
    :global([data-sonner-toast] button[data-button]) {
      padding: 0.375rem 0.75rem !important; /* px-3 py-1.5 */
      font-size: 0.8rem !important;
      margin-left: 0.5rem !important; /* ml-2 */
    }
  }
</style>
