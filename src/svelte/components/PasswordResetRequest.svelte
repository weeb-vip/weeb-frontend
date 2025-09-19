<script lang="ts">
  import { onMount } from 'svelte';
  import { faEnvelope, faUser, faArrowLeft } from '@fortawesome/free-solid-svg-icons';
  import Fa from 'svelte-fa';
  import FormInput from './FormInput.svelte';
  import Button from './Button.svelte';
  import { initializeQueryClient } from '../services/query-client';
  import type { RequestPasswordResetInput } from '../../gql/graphql';
  import debug from '../../utils/debug';

  let formData: RequestPasswordResetInput = { username: '', email: '' };
  let errorMessage = '';
  let submitted = false;
  let blocked = false;

  let QueryClientProvider: any = null;
  let queryClient: any = null;
  let isClient = false;
  let usePasswordReset: any = null;
  let passwordResetMutation: any = null;

  onMount(async () => {
    // Initialize TanStack Query
    try {
      const { QueryClientProvider: QCP } = await import('@tanstack/svelte-query');
      const { usePasswordReset: uPR } = await import('../services/queries');

      QueryClientProvider = QCP;
      usePasswordReset = uPR;
      queryClient = initializeQueryClient();
      passwordResetMutation = usePasswordReset();
      isClient = true;
    } catch (error) {
      console.warn('Failed to load TanStack Query:', error);
      isClient = true;
    }
  });

  function handleInputChange(event: CustomEvent) {
    const { value, originalEvent } = event.detail;
    const target = originalEvent?.target as HTMLInputElement;

    if (!target) return;

    const name = target.name;

    formData = {
      ...formData,
      [name]: value
    };

    // Clear error when user starts typing
    if (errorMessage) {
      errorMessage = '';
    }
  }

  async function handleSubmit(event: Event) {
    event.preventDefault();

    if (blocked || submitted || !passwordResetMutation) return;

    if (!formData.username.trim() || !formData.email.trim()) {
      errorMessage = 'Please fill in all fields';
      return;
    }

    errorMessage = '';
    blocked = true;

    try {
      const result = await passwordResetMutation.mutateAsync({ input: formData });
      if (result) {
        debug.auth('Password reset request successful');
        submitted = true;
        blocked = true; // Keep blocked in success state
      } else {
        errorMessage = 'Failed to send password reset email. Please try again.';
        blocked = false;
      }
    } catch (err: any) {
      console.error('Password reset request failed:', err);
      debug.error('Password reset request failed:', err);
      errorMessage = err?.message || 'Failed to send password reset email. Please try again.';
      blocked = false;
    }
  }

  $: isLoading = passwordResetMutation ? passwordResetMutation.isPending : false;
  $: disabled = blocked || submitted;

  // Handle keyboard events to prevent submission while blocked
  function handleKeyDown(event: KeyboardEvent) {
    if (blocked && (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar')) {
      event.preventDefault();
      event.stopPropagation();
    }
  }
</script>

<svelte:document on:keydown={handleKeyDown} />

{#if isClient}
  {#if QueryClientProvider && queryClient}
    <svelte:component this={QueryClientProvider} client={queryClient}>
      <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
        <div class="max-w-md w-full space-y-8 relative">

    {#if submitted}
      <!-- Success state -->
      <div class="text-center">
        <div class="mx-auto h-12 w-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
          <Fa icon={faEnvelope} class="text-green-600 dark:text-green-400 text-xl" />
        </div>
        <h2 class="text-3xl font-bold text-gray-900 dark:text-gray-100">Check your email</h2>
        <p class="mt-4 text-gray-600 dark:text-gray-400">
          We've sent a password reset link to <strong>{formData.email}</strong>
        </p>
        <p class="mt-2 text-sm text-gray-500 dark:text-gray-500">
          Please check your email and follow the instructions to reset your password.
        </p>
      </div>
      <div class="mt-8">
        <a
          href="/"
          class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
        >
          <Fa icon={faArrowLeft} class="mr-2" />
          Back to Home
        </a>
      </div>

    {:else}
      <!-- Form state -->
      <!-- Click/press guard overlay while blocked -->
      {#if blocked}
        <div class="absolute inset-0 z-10 bg-transparent" aria-hidden="true"></div>
      {/if}

      <div>
        <div class="mx-auto h-12 w-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
          <Fa icon={faEnvelope} class="text-blue-600 dark:text-blue-400 text-xl" />
        </div>
        <h2 class="mt-6 text-center text-3xl font-bold text-gray-900 dark:text-gray-100">Reset your password</h2>
        <p class="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
          Enter your username and email address to receive a password reset link
        </p>
      </div>

      <form
        class="mt-8 space-y-6 relative"
        on:submit={handleSubmit}
        class:opacity-60={disabled}
        class:pointer-events-none={disabled}
        aria-busy={blocked}
      >
        <fieldset {disabled}>
          <div class="space-y-4">
            <FormInput
              id="username"
              name="username"
              type="text"
              value={formData.username}
              on:input={handleInputChange}
              placeholder="Username"
              label="Username"
              icon={faUser}
              required
              disabled={disabled}
            />

            <FormInput
              id="email"
              name="email"
              type="email"
              value={formData.email}
              on:input={handleInputChange}
              placeholder="Email address"
              label="Email address"
              icon={faEnvelope}
              required
              disabled={disabled}
            />
          </div>

          {#if errorMessage}
            <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3 mt-4">
              <p class="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
            </div>
          {/if}

          <div class="mt-4">
            <Button
              color="blue"
              label={blocked ? "Sending…" : "Send Reset Link"}
              showLabel={true}
              status={isLoading ? 'loading' : 'idle'}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md"
              disabled={disabled}
            />
          </div>

          <div class="text-center mt-2">
            <a
              href="/"
              class="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 transition-colors"
            >
              ← Back to Home
            </a>
          </div>
        </fieldset>
      </form>
    {/if}

        </div>
      </div>
    </svelte:component>
  {:else}
    <!-- Fallback without QueryClient - show skeleton -->
    <slot name="fallback">
      <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
        <div class="max-w-md w-full space-y-8">
          <div class="text-center">
            <p class="text-gray-600 dark:text-gray-400">Loading...</p>
          </div>
        </div>
      </div>
    </slot>
  {/if}
{:else}
  <!-- SSR fallback - show skeleton -->
  <slot name="fallback">
    <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div class="max-w-md w-full space-y-8">
        <div class="text-center">
          <p class="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    </div>
  </slot>
{/if}