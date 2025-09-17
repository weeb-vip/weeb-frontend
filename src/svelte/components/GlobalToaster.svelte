<script>
  import { Toaster } from 'svelte-sonner';
</script>

<!-- Global Toaster Configuration -->
<Toaster
  position="top-right"
  class="toaster-container"
  toastOptions={{
    duration: 6000,
    className: 'custom-toast',
  }}
/>

<style>
  :global(.toaster-container) {
    top: 6.5rem !important; /* Desktop header: 96px (6rem) + small gap */
    right: 1.5rem !important;
    z-index: 40 !important;
  }

  /* Standard toasts */
  :global(.custom-toast) {
    background: rgb(255, 255, 255) !important;
    backdrop-filter: blur(12px) !important;
    border: 1px solid rgb(229, 231, 235) !important;
    border-radius: 1rem !important;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1) !important;
    max-width: 20rem !important;
    font-size: 0.875rem !important;
    padding: 0.75rem !important;
    transition: background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease !important;
  }

  :global(.dark .custom-toast) {
    background: rgb(31, 41, 55) !important;
    border-color: rgb(55, 65, 81) !important;
    color: white !important;
  }

  /* Custom anime toasts - fully rounded with theme colors */
  :global([data-sonner-toast][data-custom="true"]) {
    background: rgb(255, 255, 255) !important;
    border: 1px solid rgb(229, 231, 235) !important;
    border-radius: 1.5rem !important;
    padding: 0.875rem !important;
    max-width: 24rem !important;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1) !important;
    transition: background-color 0.3s ease, border-color 0.3s ease !important;
  }

  :global(.dark [data-sonner-toast][data-custom="true"]) {
    background: rgb(31, 41, 55) !important;
    border-color: rgb(55, 65, 81) !important;
  }

  /* Ensure all toasts have visible backgrounds with transitions */


  /* Type-specific colored accents */
  :global(.custom-toast[data-type="success"]) {
    border-left: 4px solid rgb(34, 197, 94) !important;
  }

  :global(.custom-toast[data-type="error"]) {
    border-left: 4px solid rgb(239, 68, 68) !important;
  }

  :global(.custom-toast[data-type="warning"]) {
    border-left: 4px solid rgb(234, 179, 8) !important;
  }

  :global(.custom-toast[data-type="info"]) {
    border-left: 4px solid rgb(59, 130, 246) !important;
  }

  /* Mobile responsiveness */
  @media (max-width: 640px) {
    :global(.toaster-container) {
      top: 6rem !important; /* Mobile header: 72px (4.5rem) + small gap */
      right: 1rem !important;
      left: 1rem !important;
    }

    :global(.custom-toast) {
      max-width: 100% !important;
      font-size: 0.75rem !important;
    }
  }

  /* Tablet (between mobile and desktop) */
  @media (min-width: 640px) and (max-width: 1023px) {
    :global(.toaster-container) {
      top: 5rem !important; /* Tablet uses mobile header layout */
    }
  }
</style>
