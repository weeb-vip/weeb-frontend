<script lang="ts">
  import { faUser, faArrowLeft, faEnvelope } from '@fortawesome/free-solid-svg-icons';
  import Fa from 'svelte-fa';
  import FormInput from './FormInput.svelte';
  import Button from './Button.svelte';
  import { useResendVerificationEmail } from '../services/queries';
  import debug from '../../utils/debug';

  let formData = {
    username: ''
  };
  let errorMessage = '';
  let successMessage = '';

  const resendMutation = useResendVerificationEmail();

  // Handle resend state changes
  $: if ($resendMutation.isSuccess) {
    debug.success('Verification email resent successfully');
    successMessage = 'Verification email sent! Please check your inbox and spam folder.';
    errorMessage = '';
    formData = { username: '' };
  }

  $: if ($resendMutation.isError) {
    debug.error('Failed to resend verification email', $resendMutation.error);
    let errorMsg = 'Failed to send verification email. Please try again.';

    if ($resendMutation.error?.message?.includes('User not found') || $resendMutation.error?.message?.includes('not found')) {
      errorMsg = 'No account found with this email address. Please check and try again.';
    } else if ($resendMutation.error?.message?.includes('already verified') || $resendMutation.error?.message?.includes('verified')) {
      errorMsg = 'Your email is already verified. You can proceed to login.';
    } else if ($resendMutation.error?.message?.includes('network') || $resendMutation.error?.message?.includes('fetch')) {
      errorMsg = 'Network error. Please check your connection and try again.';
    } else if ($resendMutation.error?.message) {
      errorMsg = $resendMutation.error.message;
    }

    errorMessage = errorMsg;
    successMessage = '';
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

    // Clear messages when user starts typing
    if (errorMessage) {
      errorMessage = '';
    }
    if (successMessage) {
      successMessage = '';
    }
  }

  function handleSubmit(event: Event) {
    event.preventDefault();

    if (!formData.username.trim()) {
      errorMessage = 'Please enter your email address.';
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.username)) {
      errorMessage = 'Please enter a valid email address.';
      return;
    }

    errorMessage = '';
    successMessage = '';
    $resendMutation.mutate({ username: formData.username });
  }

  $: isLoading = $resendMutation.isPending;
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
        Resend Email Verification
      </h2>
      <p class="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
        Enter your email address to receive a new verification link
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
          required
        />
      </div>

      {#if errorMessage}
        <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
          <p class="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
        </div>
      {/if}

      {#if successMessage}
        <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-3">
          <div class="flex items-center">
            <Fa icon={faEnvelope} class="text-green-400 mr-2" />
            <p class="text-sm text-green-600 dark:text-green-400">{successMessage}</p>
          </div>
        </div>
      {/if}

      <div>
        <Button
          color="blue"
          label="Send Verification Email"
          onClick={() => {}}
          showLabel={true}
          status={isLoading ? 'loading' : 'idle'}
          className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md"
        />
      </div>

      <div class="text-center space-y-2">
        <p class="text-sm text-gray-600 dark:text-gray-400">
          Already verified?{' '}
          <a
            href="/auth/login"
            class="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 transition-colors"
          >
            Sign in here
          </a>
        </p>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          Need help?{' '}
          <a
            href="/auth/password-reset-request"
            class="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 transition-colors"
          >
            Reset your password
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