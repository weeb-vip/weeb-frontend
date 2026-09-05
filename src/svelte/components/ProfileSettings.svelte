<script lang="ts">
  import { faUser, faEnvelope, faGlobe, faArrowLeft } from '@fortawesome/free-solid-svg-icons';
  import Fa from 'svelte-fa';
  import Button from './Button.svelte';
  import ErrorBanner from './ErrorBanner.svelte';
  import FormInput from './FormInput.svelte';
  import Skeleton from './Skeleton.svelte';
  import { ProfileSettingsBloc, type ProfileFormField } from './ProfileSettings.bloc.svelte';

  /**
   * The settings form.
   *
   * A view over the bloc: it holds the edits, decides what has actually changed
   * and owns the save; this renders the fields and forwards what was typed.
   */
  let { bloc = new ProfileSettingsBloc() }: { bloc?: ProfileSettingsBloc } = $props();

  /** FormInput reports the value plus the event it came from, which names the field. */
  function onField(detail: { value: string; originalEvent: Event }): void {
    const name = (detail.originalEvent.target as HTMLInputElement).name as ProfileFormField;
    bloc.setField(name, detail.value);
  }
</script>

{#if bloc.isLoading}
  <div class="max-w-2xl mx-auto p-6">
    <div class="mb-6 space-y-4">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-64" />
    </div>
    <div class="bg-weeb-surface shadow rounded-lg p-6">
      <div class="space-y-6">
        {#each Array(5) as _}
          <Skeleton className="h-16 w-full" />
        {/each}
      </div>
    </div>
  </div>
{:else if bloc.hasUser}
  <div class="max-w-2xl mx-auto p-6">
    <div class="mb-6">
      <a
        href="/profile"
        class="inline-flex items-center text-weeb-accent-text hover:text-weeb-accent-text transition-colors mb-4"
      >
        <Fa icon={faArrowLeft} class="mr-2" />
        Back to Profile
      </a>
      <h1 class="text-2xl font-bold text-weeb-fg">Profile Settings</h1>
      <p class="text-weeb-fg-muted mt-1">Update your personal information and preferences</p>
    </div>

    <div class="bg-weeb-surface shadow rounded-lg p-6 transition-colors duration-300">
      <form
        class="space-y-6"
        onsubmit={(e) => {
          e.preventDefault();
          bloc.submit();
        }}
      >
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormInput
            id="firstname"
            name="firstname"
            type="text"
            value={bloc.form.firstname}
            onInput={onField}
            placeholder="First Name"
            label="First Name"
            icon={faUser}
            required={false}
          />

          <FormInput
            id="lastname"
            name="lastname"
            type="text"
            value={bloc.form.lastname}
            onInput={onField}
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
          value={bloc.form.username}
          onInput={onField}
          placeholder="Username"
          label="Username"
          icon={faUser}
          error={bloc.usernameError}
          required={true}
        />

        <FormInput
          id="email"
          name="email"
          type="email"
          value={bloc.form.email}
          onInput={onField}
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
            value={bloc.form.language}
            onchange={(e) => bloc.setLanguage(e.currentTarget.value)}
            class="w-full px-3 py-2 border border-weeb-border rounded-md shadow-sm bg-weeb-surface text-weeb-fg focus:outline-none focus:ring-2 focus:ring-weeb-accent focus:border-weeb-accent transition-colors duration-200"
          >
            {#each bloc.languages as language (language.value)}
              <option value={language.value}>{language.label}</option>
            {/each}
          </select>
        </div>

        <!-- Public page customization -->
        <div class="pt-2">
          <h2 class="text-sm font-semibold text-weeb-fg mb-1">Your public page</h2>
          <p class="text-xs text-weeb-fg-muted mb-4">
            How <span class="font-mono">/u/{bloc.form.username || 'you'}</span> looks to anyone who visits.
          </p>

          <div>
            <label for="bio" class="block text-sm font-medium text-weeb-fg-secondary mb-2">Bio</label>
            <textarea
              id="bio"
              name="bio"
              rows="2"
              maxlength={bloc.bioLimit}
              value={bloc.form.bio}
              oninput={(e) => bloc.setField('bio', e.currentTarget.value)}
              placeholder="A line about you"
              class="w-full px-3 py-2 border border-weeb-border rounded-md bg-weeb-surface text-weeb-fg placeholder:text-weeb-fg-muted focus:outline-none focus:ring-2 focus:ring-weeb-accent focus:border-weeb-accent transition-colors resize-none"
            ></textarea>
            <div class="mt-1 text-right text-xs text-weeb-fg-muted font-mono">
              {bloc.bioLength}/{bloc.bioLimit}
            </div>
          </div>

          <div class="mt-4">
            <span class="block text-sm font-medium text-weeb-fg-secondary mb-2">Accent colour</span>
            <div class="flex flex-wrap gap-2">
              {#each bloc.accents as accent (accent.name)}
                <button
                  type="button"
                  title={accent.label}
                  aria-label={accent.label}
                  aria-pressed={bloc.isAccentSelected(accent.name)}
                  onclick={() => bloc.selectAccent(accent.name)}
                  class="w-8 h-8 rounded-full transition-transform hover:scale-110 {bloc.isAccentSelected(accent.name) ? 'ring-2 ring-offset-2 ring-offset-weeb-bg ring-weeb-fg' : ''}"
                  style="background: {accent.value}"
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
              aria-checked={bloc.form.listsPublic}
              aria-label="Show my lists on my public page"
              onclick={() => bloc.toggleListsPublic()}
              class="relative shrink-0 w-11 h-6 rounded-full transition-colors {bloc.form.listsPublic ? 'bg-weeb-accent' : 'bg-weeb-surface-hover'}"
            >
              <span class="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform {bloc.form.listsPublic ? 'translate-x-5' : ''}"></span>
            </button>
          </div>
        </div>

        {#if bloc.successMessage}
          <ErrorBanner severity="success" message={bloc.successMessage} />
        {/if}

        {#if bloc.errorMessage}
          <ErrorBanner message={bloc.errorMessage} />
        {/if}

        <div class="flex gap-4 pt-4">
          <Button
            color="blue"
            label="Save Changes"
            onClick={() => {}}
            showLabel={true}
            status={bloc.isSaving ? 'loading' : 'idle'}
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
