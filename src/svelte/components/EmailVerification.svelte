<script lang="ts">
  import { onMount } from 'svelte';
  import debug from '../../utils/debug';
  import { useVerifyEmail } from '../services/queries';

  interface VerificationState {
    loading: boolean;
    success: boolean;
    error: string | null;
  }

  let state: VerificationState = {
    loading: false,
    success: false,
    error: null
  };

  let email: string | null = null;
  let token: string | null = null;

  const verifyEmailMutation = useVerifyEmail();

  // Handle verification state changes
  $: if ($verifyEmailMutation.isSuccess) {
    debug.success('Email verification successful');
    state = {
      loading: false,
      success: true,
      error: null
    };
  }

  $: if ($verifyEmailMutation.isError) {
    debug.error('Email verification failed', $verifyEmailMutation.error);
    state = {
      loading: false,
      success: false,
      error: 'The verification token may be invalid or have expired. Please request a new verification email.'
    };
  }

  onMount(() => {
    // Get search params
    const searchParams = new URLSearchParams(window.location.search);
    email = searchParams.get('email');
    token = searchParams.get('token');

    if (!email || !token) {
      state = {
        loading: false,
        success: false,
        error: 'Invalid verification link. Missing email or token.'
      };
      return;
    }

    // Auto-start verification when component mounts
    state = { ...state, loading: true };
    $verifyEmailMutation.mutate(token);
  });

  function handleRetry() {
    if (token) {
      state = { ...state, loading: true, error: null };
      $verifyEmailMutation.mutate(token);
    }
  }
</script>

<div class="min-h-screen bg-weeb-bg-elevated flex flex-col justify-center py-12 sm:px-6 lg:px-8">
  <div class="sm:mx-auto sm:w-full sm:max-w-md">
    <div class="flex justify-center">
      <img
        class="h-12 w-auto"
        src="/assets/icons/logo6-rev-sm_sm.png"
        alt="Weeb VIP"
        on:error={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
    </div>
    <h2 class="mt-6 text-center text-3xl font-extrabold text-weeb-fg text-weeb-fg">
      Email Verification
    </h2>
    {#if email}
      <p class="mt-2 text-center text-sm text-weeb-fg-muted">
        Verifying email address: <span class="font-medium">{decodeURIComponent(email)}</span>
      </p>
    {/if}
  </div>

  <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
    <div class="bg-weeb-surface py-8 px-4 shadow sm:rounded-lg sm:px-10">
      {#if state.loading}
        <div class="text-center">
          <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-weeb-accent"></div>
          <p class="mt-4 text-sm text-weeb-fg-muted">
            Verifying your email address...
          </p>
        </div>
      {/if}

      {#if state.success}
        <div class="text-center">
          <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-weeb-green/15">
            <svg
              class="h-6 w-6 text-weeb-green"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h3 class="mt-4 text-lg font-medium text-weeb-fg text-weeb-fg">
            Email Verified Successfully!
          </h3>
          <p class="mt-2 text-sm text-weeb-fg-muted">
            Your email address has been verified. You can now log in to your account.
          </p>
          <div class="mt-6">
            <a
              href="/auth/login"
              class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-weeb-accent hover:bg-weeb-accent-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-weeb-accent transition-colors duration-200"
            >
              Go to Login
            </a>
          </div>
        </div>
      {/if}

      {#if state.error}
        <div class="text-center">
          <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-weeb-red/15">
            <svg
              class="h-6 w-6 text-weeb-red"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h3 class="mt-4 text-lg font-medium text-weeb-fg text-weeb-fg">
            Verification Failed
          </h3>
          <p class="mt-2 text-sm text-weeb-fg-muted">
            {state.error}
          </p>
          <div class="mt-6 space-y-3">
            {#if token}
              <button
                on:click={handleRetry}
                class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-weeb-accent hover:bg-weeb-accent-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-weeb-accent transition-colors duration-200"
              >
                Try Again
              </button>
            {/if}
            <a
              href="/auth/login"
              class="w-full flex justify-center py-2 px-4 border border-weeb-border rounded-md shadow-sm text-sm font-medium text-weeb-fg-secondary bg-weeb-surface hover:bg-weeb-surface-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-weeb-accent transition-colors duration-200"
            >
              Back to Login
            </a>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>