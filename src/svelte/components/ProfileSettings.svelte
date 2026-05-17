<script lang="ts">
  import { onMount } from 'svelte';
  import { createQuery, createMutation } from '@tanstack/svelte-query';
  import { faUser, faEnvelope, faGlobe, faArrowLeft, faCheck } from '@fortawesome/free-solid-svg-icons';
  import { getUser, updateUserDetails } from '../../services/queries';
  import { Language, type UpdateUserInput } from '../../gql/graphql';
  import { initializeQueryClient } from '../services/query-client';
  import Button from './Button.svelte';
  import FormInput from './FormInput.svelte';
  import Fa from 'svelte-fa';
  import debug from '../../utils/debug';

  // Initialize query client
  const queryClient = initializeQueryClient();

  let mounted = false;
  let successMessage = '';
  let errorMessage = '';

  // Form data state
  let formData: UpdateUserInput = {
    firstname: '',
    lastname: '',
    username: '',
    email: '',
    language: Language.En
  };

  // Client-side only queries
  let userQuery: any;

  onMount(() => {
    mounted = true;
    userQuery = createQuery(getUser(), queryClient);
  });

  // Update form data when user data is loaded
  $: if (userQuery && $userQuery.data) {
    formData = {
      firstname: $userQuery.data.firstname || '',
      lastname: $userQuery.data.lastname || '',
      username: $userQuery.data.username || '',
      email: $userQuery.data.email || '',
      language: $userQuery.data.language || Language.En
    };
  }

  const updateMutation = createMutation({
    ...updateUserDetails(),
    onSuccess: (updatedUser) => {
      debug.success('Profile updated successfully');
      successMessage = 'Profile updated successfully!';
      errorMessage = '';

      // Update the cached user data
      queryClient.setQueryData(['user'], updatedUser);

      // Clear success message after 3 seconds
      setTimeout(() => {
        successMessage = '';
      }, 3000);
    },
    onError: (error: any) => {
      debug.error('Profile update failed', error);
      errorMessage = error?.message || 'Failed to update profile. Please try again.';
      successMessage = '';
    }
  }, queryClient);

  function handleInputChange(event: CustomEvent) {
    const { value, originalEvent } = event.detail;
    const name = (originalEvent.target as HTMLInputElement).name;

    formData = {
      ...formData,
      [name]: value
    };

    // Clear messages when user starts typing
    if (errorMessage) errorMessage = '';
    if (successMessage) successMessage = '';
  }

  function handleLanguageChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    formData = {
      ...formData,
      language: target.value as Language
    };

    // Clear messages when user changes language
    if (errorMessage) errorMessage = '';
    if (successMessage) successMessage = '';
  }

  function handleSubmit(event: Event) {
    event.preventDefault();

    if (!userQuery || !$userQuery.data) return;

    // Basic validation
    if (!formData.firstname?.trim() || !formData.lastname?.trim() || !formData.username?.trim()) {
      errorMessage = 'First name, last name, and username are required.';
      return;
    }

    // Only send fields that have changed
    const changedFields: UpdateUserInput = {};
    if (formData.firstname !== $userQuery.data.firstname) changedFields.firstname = formData.firstname;
    if (formData.lastname !== $userQuery.data.lastname) changedFields.lastname = formData.lastname;
    if (formData.username !== $userQuery.data.username) changedFields.username = formData.username;
    if (formData.email !== $userQuery.data.email) changedFields.email = formData.email;
    if (formData.language !== $userQuery.data.language) changedFields.language = formData.language;

    // If nothing changed, show message
    if (Object.keys(changedFields).length === 0) {
      successMessage = 'No changes to save.';
      return;
    }

    errorMessage = '';
    $updateMutation.mutate(changedFields);
  }
</script>

{#if !mounted || !userQuery || (userQuery && $userQuery.isLoading)}
  <!-- Loading skeleton -->
  <div class="max-w-2xl mx-auto p-6">
    <div class="mb-6">
      <div class="h-4 bg-weeb-surface-hover bg-weeb-surface-hover rounded w-32 mb-4 animate-pulse"></div>
      <div class="h-8 bg-weeb-surface-hover bg-weeb-surface-hover rounded w-48 mb-2 animate-pulse"></div>
      <div class="h-4 bg-weeb-surface-hover bg-weeb-surface-hover rounded w-64 animate-pulse"></div>
    </div>
    <div class="bg-weeb-surface shadow rounded-lg p-6">
      <div class="space-y-6">
        {#each Array(5) as _}
          <div class="h-16 bg-weeb-surface rounded animate-pulse"></div>
        {/each}
      </div>
    </div>
  </div>
{:else if userQuery && $userQuery.data}
  <div class="max-w-2xl mx-auto p-6">
    <div class="mb-6">
      <a
        href="/profile"
        class="inline-flex items-center text-weeb-accent hover:text-weeb-accent transition-colors mb-4"
      >
        <Fa icon={faArrowLeft} class="mr-2" />
        Back to Profile
      </a>
      <h1 class="text-2xl font-bold text-weeb-fg text-weeb-fg">Profile Settings</h1>
      <p class="text-weeb-fg-muted mt-1">Update your personal information and preferences</p>
    </div>

    <div class="bg-weeb-surface shadow rounded-lg p-6 transition-colors duration-300">
      <form on:submit={handleSubmit} class="space-y-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormInput
            id="firstname"
            name="firstname"
            type="text"
            value={formData.firstname || ''}
            on:input={handleInputChange}
            placeholder="First Name"
            label="First Name"
            icon={faUser}
            required={true}
          />

          <FormInput
            id="lastname"
            name="lastname"
            type="text"
            value={formData.lastname || ''}
            on:input={handleInputChange}
            placeholder="Last Name"
            label="Last Name"
            icon={faUser}
            required={true}
          />
        </div>

        <FormInput
          id="username"
          name="username"
          type="text"
          value={formData.username || ''}
          on:input={handleInputChange}
          placeholder="Username"
          label="Username"
          icon={faUser}
          required={true}
        />

        <FormInput
          id="email"
          name="email"
          type="email"
          value={formData.email || ''}
          on:input={handleInputChange}
          placeholder="Email Address (optional)"
          label="Email Address"
          icon={faEnvelope}
        />

        <div>
          <label for="language" class="block text-sm font-medium text-weeb-fg-secondary mb-2">
            <Fa icon={faGlobe} class="mr-2" />
            Language
          </label>
          <select
            id="language"
            name="language"
            value={formData.language || ''}
            on:change={handleLanguageChange}
            class="w-full px-3 py-2 border border-weeb-border rounded-md shadow-sm bg-weeb-surface text-weeb-fg focus:outline-none focus:ring-2 focus:ring-weeb-accent focus:border-weeb-accent transition-colors duration-200"
          >
            <option value={Language.En}>English</option>
            <option value={Language.Th}>Thai</option>
          </select>
        </div>

        {#if successMessage}
          <div class="bg-weeb-green/10 border border-weeb-green rounded-md p-3 flex items-center">
            <Fa icon={faCheck} class="text-weeb-green mr-2" />
            <p class="text-sm text-weeb-green">{successMessage}</p>
          </div>
        {/if}

        {#if errorMessage}
          <div class="bg-weeb-red/10 border border-weeb-red/30 rounded-md p-3">
            <p class="text-sm text-weeb-red">{errorMessage}</p>
          </div>
        {/if}

        <div class="flex gap-4 pt-4">
          <Button
            color="blue"
            label="Save Changes"
            onClick={() => {}}
            showLabel={true}
            status={$updateMutation.isLoading ? 'loading' : 'idle'}
            className="flex-1"
          />
          <a
            href="/profile"
            class="px-4 py-2 border border-weeb-border rounded-md text-weeb-fg-secondary hover:bg-weeb-surface-hover transition-colors duration-200 inline-flex items-center justify-center"
          >
            Cancel
          </a>
        </div>
      </form>
    </div>
  </div>
{/if}