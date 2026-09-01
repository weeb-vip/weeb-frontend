<script lang="ts">
  import { onMount } from 'svelte';
  import { createQuery, createMutation } from '@tanstack/svelte-query';
  import {
    faUser,
    faEnvelope,
    faGlobe,
    faArrowLeft,
    faCheck
  } from '@fortawesome/free-solid-svg-icons';
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
    language: Language.En,
    bio: '',
    accentColor: '',
    listsPublic: false
  };

  // The curated set the accent picker offers. A token name is stored, not a raw
  // colour, so a page can only ever theme itself from this palette.
  const ACCENT_OPTIONS: { name: string; label: string; value: string }[] = [
    { name: 'violet', label: 'Violet', value: 'oklch(55% 0.16 298)' },
    { name: 'blue', label: 'Blue', value: 'oklch(58% 0.15 250)' },
    { name: 'cyan', label: 'Cyan', value: 'oklch(64% 0.12 210)' },
    { name: 'green', label: 'Green', value: 'oklch(62% 0.15 150)' },
    { name: 'amber', label: 'Amber', value: 'oklch(72% 0.14 75)' },
    { name: 'rose', label: 'Rose', value: 'oklch(62% 0.18 20)' },
    { name: 'pink', label: 'Pink', value: 'oklch(64% 0.18 350)' }
  ];

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
      language: $userQuery.data.language || Language.En,
      bio: $userQuery.data.bio || '',
      accentColor: $userQuery.data.accentColor || '',
      listsPublic: $userQuery.data.listsPublic ?? false
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

  function selectAccent(name: string) {
    formData = { ...formData, accentColor: formData.accentColor === name ? '' : name };
    if (errorMessage) errorMessage = '';
    if (successMessage) successMessage = '';
  }

  function toggleListsPublic() {
    formData = { ...formData, listsPublic: !formData.listsPublic };
    if (errorMessage) errorMessage = '';
    if (successMessage) successMessage = '';
  }

  function handleSubmit(event: Event) {
    event.preventDefault();

    if (!userQuery || !$userQuery.data) return;

    // Only the username is required.
    //
    // First and last name are never collected: registration asks for a username
    // and a password, so both are blank on every account that has not edited
    // them. Requiring them here made them a roadblock in front of changing the
    // username -- the one field the account actually has -- rather than
    // information the product ever asked for.
    if (!formData.username?.trim()) {
      errorMessage = 'Username is required.';
      return;
    }

    // Only send fields that have changed
    const changedFields: UpdateUserInput = {};
    if (formData.firstname !== $userQuery.data.firstname) changedFields.firstname = formData.firstname;
    if (formData.lastname !== $userQuery.data.lastname) changedFields.lastname = formData.lastname;
    if (formData.username !== $userQuery.data.username) changedFields.username = formData.username;
    if (formData.email !== $userQuery.data.email) changedFields.email = formData.email;
    if (formData.language !== $userQuery.data.language) changedFields.language = formData.language;
    if ((formData.bio || '') !== ($userQuery.data.bio || '')) changedFields.bio = formData.bio || '';
    if ((formData.accentColor || '') !== ($userQuery.data.accentColor || '')) changedFields.accentColor = formData.accentColor || '';
    if (formData.listsPublic !== ($userQuery.data.listsPublic ?? false)) changedFields.listsPublic = formData.listsPublic;

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
        class="inline-flex items-center text-weeb-accent-text hover:text-weeb-accent-text transition-colors mb-4"
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
            required={false}
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
            required={false}
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

        <!-- Public page customization -->
        <div class="pt-2">
          <h2 class="text-sm font-semibold text-weeb-fg mb-1">Your public page</h2>
          <p class="text-xs text-weeb-fg-muted mb-4">
            How <span class="font-mono">/u/{formData.username || 'you'}</span> looks to anyone who visits.
          </p>

          <div>
            <label for="bio" class="block text-sm font-medium text-weeb-fg-secondary mb-2">Bio</label>
            <textarea
              id="bio"
              name="bio"
              rows="2"
              maxlength="300"
              value={formData.bio || ''}
              on:input={(e) => { formData = { ...formData, bio: (e.target as HTMLTextAreaElement).value }; if (successMessage) successMessage = ''; }}
              placeholder="A line about you"
              class="w-full px-3 py-2 border border-weeb-border rounded-md bg-weeb-surface text-weeb-fg placeholder:text-weeb-fg-muted focus:outline-none focus:ring-2 focus:ring-weeb-accent focus:border-weeb-accent transition-colors resize-none"
            ></textarea>
            <div class="mt-1 text-right text-xs text-weeb-fg-muted font-mono">{(formData.bio || '').length}/300</div>
          </div>

          <div class="mt-4">
            <span class="block text-sm font-medium text-weeb-fg-secondary mb-2">Accent colour</span>
            <div class="flex flex-wrap gap-2">
              {#each ACCENT_OPTIONS as opt}
                <button
                  type="button"
                  title={opt.label}
                  aria-label={opt.label}
                  aria-pressed={formData.accentColor === opt.name}
                  on:click={() => selectAccent(opt.name)}
                  class="w-8 h-8 rounded-full transition-transform hover:scale-110 {formData.accentColor === opt.name ? 'ring-2 ring-offset-2 ring-offset-weeb-bg ring-weeb-fg' : ''}"
                  style="background: {opt.value}"
                ></button>
              {/each}
            </div>
          </div>

          <div class="mt-4 flex items-center justify-between gap-4">
            <div>
              <span class="block text-sm font-medium text-weeb-fg-secondary">Show my lists</span>
              <span class="block text-xs text-weeb-fg-muted">Let visitors see your watch and read lists. Your header is always public.</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={!!formData.listsPublic}
              aria-label="Show my lists on my public page"
              on:click={toggleListsPublic}
              class="relative shrink-0 w-11 h-6 rounded-full transition-colors {formData.listsPublic ? 'bg-weeb-accent' : 'bg-weeb-surface-hover'}"
            >
              <span class="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform {formData.listsPublic ? 'translate-x-5' : ''}"></span>
            </button>
          </div>
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
            status={$updateMutation.isPending ? 'loading' : 'idle'}
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