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
        Resend Email Verification
      </h2>
      <p class="mt-2 text-center text-sm text-weeb-fg-muted">
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
        <div class="bg-weeb-red/10 border border-weeb-red/30 rounded-md p-3">
          <p class="text-sm text-weeb-red">{errorMessage}</p>
        </div>
      {/if}

      {#if successMessage}
        <div class="bg-weeb-green/10 border border-weeb-green rounded-md p-3">
          <div class="flex items-center">
            <Fa icon={faEnvelope} class="text-weeb-green mr-2" />
            <p class="text-sm text-weeb-green">{successMessage}</p>
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
        <p class="text-sm text-weeb-fg-muted">
          Already verified?{' '}
          <a
            href="/auth/login"
            class="text-weeb-accent hover:text-weeb-accent transition-colors"
          >
            Sign in here
          </a>
        </p>
        <p class="text-sm text-weeb-fg-muted">
          Need help?{' '}
          <a
            href="/auth/password-reset-request"
            class="text-weeb-accent hover:text-weeb-accent transition-colors"
          >
            Reset your password
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