<script lang="ts">
  import { onMount } from 'svelte';
  import { faUser, faLock } from '@fortawesome/free-solid-svg-icons';
  import type { LoginInput } from "../../gql/graphql";
  import { useLogin, useRegister } from '../services/queries';
  import { loggedInStore, loginModalStore } from '../stores/auth';
  import { navigateWithTransition } from '../../utils/astro-navigation';
  import FormInput from './FormInput.svelte';
  import Button from './Button.svelte';

  export let closeFn: (() => void) | undefined = undefined;

  let registerState = false;
  let isRegisterState = registerState;
  let formData = {
    username: "",
    password: "",
    confirmPassword: "", // for registration validation
  };
  let errorMessage = "";
  let successMessage = "";
  let validationErrors: Record<string, string> = {};

  const loginMutation = useLogin();
  const registerMutation = useRegister();

  // Subscribe to login modal state
  onMount(() => {
    const unsubscribe = loginModalStore.subscribe(state => {
      registerState = state.register;
      isRegisterState = state.register;
    });
    return unsubscribe;
  });

  $: isLoading = $loginMutation.isPending || $registerMutation.isPending;

  // Handle login state changes
  $: if ($loginMutation.isSuccess && $loginMutation.data) {
    loggedInStore.setLoggedIn({
      id: $loginMutation.data.id
    });
    errorMessage = "";

    // Dispatch custom event to trigger data refresh
    console.log('🎉 Login successful - dispatching loginSuccess event');
    window.dispatchEvent(new CustomEvent('loginSuccess'));

    if (closeFn) {
      closeFn();
    }
  }

  $: if ($loginMutation.isError) {
    errorMessage = 'Unable to sign in. Please check your credentials and try again.';
  }

  // Handle register state changes
  $: if ($registerMutation.isSuccess) {
    errorMessage = "";
    successMessage = "Registration successful! Please check your email to verify your account before logging in.";
  }

  $: if ($registerMutation.isError) {
    errorMessage = 'Unable to create account. Please try again.';
  }

  function validateForm() {
    const errors: Record<string, string> = {};

    if (!formData.username.trim()) {
      errors.username = "Username is required";
    } else if (formData.username.length < 3) {
      errors.username = "Username must be at least 3 characters";
    }

    if (!formData.password) {
      errors.password = "Password is required";
    } else if (formData.password.length < 6) {
      errors.password = "Password must be at least 6 characters";
    }

    if (isRegisterState) {
      if (!formData.confirmPassword) {
        errors.confirmPassword = "Please confirm your password";
      } else if (formData.password !== formData.confirmPassword) {
        errors.confirmPassword = "Passwords do not match";
      }
    }

    validationErrors = errors;
    return Object.keys(errors).length === 0;
  }

  function handleChange(field: string, value: string) {
    formData = { ...formData, [field]: value };

    // Clear validation error when user starts typing
    if (validationErrors[field]) {
      validationErrors = { ...validationErrors, [field]: "" };
    }
    // Clear global messages
    if (errorMessage) {
      errorMessage = "";
    }
    if (successMessage) {
      successMessage = "";
    }
  }

  function handleSubmit(e: Event) {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const data: LoginInput = { username: formData.username, password: formData.password };

    if (!isRegisterState) {
      $loginMutation.mutate(data);
    } else {
      $registerMutation.mutate(data);
    }
  }

  function toggleMode() {
    isRegisterState = !isRegisterState;
    errorMessage = "";
    successMessage = "";
    validationErrors = {};
  }

  function handleLinkClick(closeFn?: () => void) {
    if (closeFn) {
      closeFn();
    }
  }
</script>

<div class="w-full max-w-[360px] sm:max-w-[400px] mx-auto p-6 sm:p-8 transition-colors duration-300">
  <h2 class="text-2xl font-bold mb-6 text-weeb-fg text-center">
    {!isRegisterState ? 'Login' : 'Register'}
  </h2>

  <div class="mb-4 flex items-center">
    {#if errorMessage}
      <div class="w-full p-3 bg-weeb-red/10 border border-weeb-red/30 rounded-full transition-colors duration-300">
        <p class="text-weeb-red text-sm text-center">{errorMessage}</p>
      </div>
    {/if}
    {#if successMessage}
      <div class="w-full p-3 bg-weeb-green/10 border border-weeb-green rounded-full transition-colors duration-300">
        <p class="text-weeb-green text-sm text-center">{successMessage}</p>
      </div>
    {/if}
  </div>

  <form on:submit={handleSubmit} class="space-y-4">
    <FormInput
      id="username"
      name="username"
      type="text"
      value={formData.username}
      placeholder={!isRegisterState ? 'Enter your email' : 'Enter your email'}
      label={!isRegisterState ? 'Email' : 'Email'}
      icon={faUser}
      error={validationErrors.username}
      required={true}
      on:input={(e) => handleChange('username', e.detail.value)}
    />

    <FormInput
      id="password"
      name="password"
      type="password"
      value={formData.password}
      placeholder="Enter your password"
      label="Password"
      icon={faLock}
      error={validationErrors.password}
      required={true}
      on:input={(e) => handleChange('password', e.detail.value)}
    />

    {#if isRegisterState}
      <FormInput
        id="confirmPassword"
        name="confirmPassword"
        type="password"
        value={formData.confirmPassword}
        placeholder="Enter your password again"
        label="Confirm Password"
        icon={faLock}
        error={validationErrors.confirmPassword}
        required={true}
        on:input={(e) => handleChange('confirmPassword', e.detail.value)}
      />
    {/if}

    <Button
      color="blue"
      label={!isRegisterState ? 'Login' : 'Register'}
      onClick={() => {}}
      showLabel={true}
      status={isLoading ? 'loading' : 'idle'}
      className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md mt-6"
    />
  </form>

  <!-- Password Reset and Email Verification Links - Only show in login mode -->
  {#if !isRegisterState}
    <div class="mt-4 text-center space-y-2">
      <div>
        <a
          href="/auth/password-reset-request"
          on:click={() => handleLinkClick(closeFn)}
          class="text-sm text-weeb-accent hover:text-weeb-accent-hover transition-colors duration-300 focus:outline-none focus:underline"
        >
          Forgot your password?
        </a>
      </div>
      <div>
        <a
          href="/auth/resend-verification"
          on:click={() => handleLinkClick(closeFn)}
          class="text-sm text-weeb-accent hover:text-weeb-accent-hover transition-colors duration-300 focus:outline-none focus:underline"
        >
          Resend email verification
        </a>
      </div>
    </div>
  {/if}

  <div class="mt-6 text-center text-sm text-weeb-fg-muted">
    {!isRegisterState ? "Don't have an account?" : "Already have an account?"}{' '}
    <button
      type="button"
      on:click={toggleMode}
      class="text-weeb-accent hover:text-weeb-accent-hover font-medium transition-colors duration-300 focus:outline-none focus:underline"
    >
      {!isRegisterState ? 'Register' : 'Login'}
    </button>
  </div>
</div>