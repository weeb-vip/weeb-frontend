<script lang="ts">
  import { faUser, faLock, faArrowLeft } from '@fortawesome/free-solid-svg-icons';
  import Fa from 'svelte-fa';
  import FormInput from './FormInput.svelte';
  import type { RegisterInput } from '../../gql/graphql';
  import debug from '../../utils/debug';
  import { useRegister } from '../services/queries';

  let formData: RegisterInput & { confirmPassword: string } = {
    username: '',
    password: '',
    confirmPassword: ''
  };
  let errorMessage = '';
  let successMessage = '';
  let validationErrors: Record<string, string> = {};

  const registerMutation = useRegister();

  // Handle register state changes
  $: if ($registerMutation.isSuccess) {
    debug.success('Registration successful!');
    errorMessage = '';
    successMessage = 'Registration successful! Please check your email to verify your account before logging in.';
    formData = { username: '', password: '', confirmPassword: '' };
  }

  $: if ($registerMutation.isError) {
    debug.error('Registration failed', $registerMutation.error);
    let errorMsg = 'Registration failed. Please try again.';

    if ($registerMutation.error?.message?.includes('already exists') || $registerMutation.error?.message?.includes('exists')) {
      errorMsg = 'An account with this email already exists. Please try logging in or use a different email.';
    } else if ($registerMutation.error?.message?.includes('invalid email') || $registerMutation.error?.message?.includes('email')) {
      errorMsg = 'Please enter a valid email address.';
    } else if ($registerMutation.error?.message?.includes('password')) {
      errorMsg = 'Password requirements not met. Please ensure it\'s at least 6 characters long.';
    } else if ($registerMutation.error?.message?.includes('network') || $registerMutation.error?.message?.includes('fetch')) {
      errorMsg = 'Network error. Please check your connection and try again.';
    } else if ($registerMutation.error?.message) {
      errorMsg = $registerMutation.error.message;
    }

    errorMessage = errorMsg;
    successMessage = '';
  }

  function validateForm() {
    const errors: Record<string, string> = {};

    if (!formData.username.trim()) {
      errors.username = 'Email is required';
    } else if (formData.username.length < 3) {
      errors.username = 'Email must be at least 3 characters';
    }

    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    validationErrors = errors;
    return Object.keys(errors).length === 0;
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

    // Clear validation error when user starts typing
    if (validationErrors[name]) {
      validationErrors = { ...validationErrors, [name]: '' };
    }
    // Clear messages
    if (errorMessage) {
      errorMessage = '';
    }
    if (successMessage) {
      successMessage = '';
    }
  }

  function handleSubmit(event: Event) {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    errorMessage = '';
    successMessage = '';
    const data: RegisterInput = { username: formData.username, password: formData.password };

    // Use the reactive mutation pattern like the modal
    $registerMutation.mutate(data);
  }

  $: isLoading = $registerMutation.isPending;
</script>

<div class="min-h-screen flex items-center justify-center bg-weeb-bg-elevated py-12 px-4 sm:px-6 lg:px-8">
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
      <h2 class="mt-6 text-center text-3xl font-extrabold text-weeb-fg text-weeb-fg">
        Create your account
      </h2>
      <p class="mt-2 text-center text-sm text-weeb-fg-muted">
        Join Weeb VIP to track your anime journey
      </p>
    </div>

    <form class="mt-8 space-y-6" on:submit={handleSubmit}>
      <div class="space-y-4">
        <FormInput
          id="username"
          name="username"
          type="email"
          value={formData.username}
          on:input={handleInputChange}
          placeholder="Email address"
          label="Email address"
          icon={faUser}
          error={validationErrors.username}
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
          error={validationErrors.password}
          required
        />

        <FormInput
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          value={formData.confirmPassword}
          on:input={handleInputChange}
          placeholder="Confirm password"
          label="Confirm password"
          icon={faLock}
          error={validationErrors.confirmPassword}
          required
        />
      </div>

      {#if errorMessage}
        <div class="bg-weeb-red/10 border border-weeb-red/30 rounded-md p-3">
          <p class="text-sm text-weeb-red">{errorMessage}</p>
        </div>
      {/if}

      {#if successMessage}
        <div class="bg-weeb-green/10 border border-weeb-green rounded-md p-3">
          <p class="text-sm text-weeb-green">{successMessage}</p>
        </div>
      {/if}

      <div>
        <button
          type="submit"
          disabled={isLoading}
          class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-weeb-accent hover:bg-weeb-accent-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-weeb-accent disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {#if isLoading}
            <span class="flex items-center">
              <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Creating account...
            </span>
          {:else}
            Register
          {/if}
        </button>
      </div>

      <div class="text-center space-y-2">
        <p class="text-sm text-weeb-fg-muted">
          Already have an account?{' '}
          <a
            href="/auth/login"
            class="text-weeb-accent hover:text-weeb-accent transition-colors"
          >
            Sign in here
          </a>
        </p>
        <a
          href="/"
          class="text-sm text-weeb-fg-muted hover:text-weeb-fg transition-colors inline-flex items-center"
        >
          <Fa icon={faArrowLeft} class="mr-2" />
          Back to Home
        </a>
      </div>
    </form>
  </div>
</div>