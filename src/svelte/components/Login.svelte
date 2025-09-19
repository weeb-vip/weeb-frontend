<script lang="ts">
  import { faUser, faLock, faArrowLeft } from '@fortawesome/free-solid-svg-icons';
  import Fa from 'svelte-fa';
  import FormInput from './FormInput.svelte';
  import Button from './Button.svelte';
  import type { LoginInput } from '../../gql/graphql';
  import debug from '../../utils/debug';
  import { useLogin } from '../services/queries';

  let formData: LoginInput = { username: '', password: '' };
  let errorMessage = '';

  const loginMutation = useLogin();

  // Handle login state changes
  $: if ($loginMutation.isSuccess) {
    debug.auth('Login successful');
    errorMessage = '';
    // Navigate to home page
    window.location.href = '/';
  }

  $: if ($loginMutation.isError) {
    debug.error('Login failed', $loginMutation.error);
    let errorMsg = 'Login failed. Please try again.';

    if ($loginMutation.error?.message?.includes('Invalid credentials') || $loginMutation.error?.message?.includes('authentication')) {
      errorMsg = 'Invalid username or password. Please check your credentials and try again.';
    } else if ($loginMutation.error?.message?.includes('network') || $loginMutation.error?.message?.includes('fetch')) {
      errorMsg = 'Network error. Please check your connection and try again.';
    } else if ($loginMutation.error?.message) {
      errorMsg = $loginMutation.error.message;
    }

    errorMessage = errorMsg;
  }

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

  function handleSubmit(event: Event) {
    event.preventDefault();

    if (!formData.username.trim() || !formData.password.trim()) {
      errorMessage = 'Please fill in all fields.';
      return;
    }

    errorMessage = '';

    // Use the reactive mutation pattern like the modal
    $loginMutation.mutate(formData);
  }

  $: isLoading = $loginMutation.isPending;
</script>

<div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
  <div class="max-w-md w-full space-y-8">
    <div>
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
      <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
        Sign in to your account
      </h2>
      <p class="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
        Welcome back! Please enter your credentials.
      </p>
    </div>

    <form class="mt-8 space-y-6" on:submit={handleSubmit}>
      <div class="space-y-4">
        <FormInput
          id="username"
          name="username"
          type="text"
          value={formData.username}
          on:input={handleInputChange}
          placeholder="Email"
          label="Email"
          icon={faUser}
          required
        />

        <FormInput
          id="password"
          name="password"
          type="password"
          value={formData.password}
          on:input={handleInputChange}
          placeholder="Password"
          label="Password"
          icon={faLock}
          required
          showPasswordToggle={true}
        />
      </div>

      {#if errorMessage}
        <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
          <p class="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
        </div>
      {/if}

      <div class="flex items-center justify-between">
        <div class="text-sm space-y-1">
          <div>
            <a
              href="/auth/password-reset-request"
              class="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 transition-colors"
            >
              Forgot your password?
            </a>
          </div>
          <div>
            <a
              href="/auth/resend-verification"
              class="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 transition-colors"
            >
              Resend email verification
            </a>
          </div>
        </div>
      </div>

      <div>
        <Button
          color="blue"
          label="Sign In"
          onClick={() => {}}
          showLabel={true}
          status={isLoading ? 'loading' : 'idle'}
          className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md"
        />
      </div>

      <div class="text-center space-y-2">
        <p class="text-sm text-gray-600 dark:text-gray-400">
          Don't have an account?{' '}
          <a
            href="/auth/register"
            class="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 transition-colors"
          >
            Sign up here
          </a>
        </p>
        <a
          href="/"
          class="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors inline-flex items-center"
        >
          <Fa icon={faArrowLeft} class="mr-2" />
          Back to Home
        </a>
      </div>
    </form>
  </div>
</div>