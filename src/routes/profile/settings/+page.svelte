<script lang="ts">
  import Seo from '$lib/Seo.svelte';
  import { faUser, faEnvelope, faGlobe, faArrowLeft } from '@fortawesome/free-solid-svg-icons';
  import Fa from 'svelte-fa';
  import Button from '$lib/components/primitives/Button';
  import ErrorBanner from '$lib/components/primitives/ErrorBanner';
  import FormInput from '$lib/components/primitives/FormInput';
  import FormTextarea from '$lib/components/primitives/FormTextarea';
  import Select from '$lib/components/primitives/Select';
  import Skeleton from '$lib/components/primitives/Skeleton';
  import { ProfileSettingsBloc, type ProfileFormField } from '$lib/components/profile/ProfileSettings.bloc.svelte';

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

<Seo
  title="Profile Settings"
  description="Update your personal information and preferences."
  noIndex={true}
/>

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

        <!-- `Select variant="field"`, so this is the same 44px control as the
             four FormInputs above it rather than a 42px/rounded-md/16px/1px
             near-miss with a white OS menu inside. The globe sits INSIDE the
             field, the way every other icon on this form does; as part of the
             label it wrapped onto a line of its own. -->
        <div class="weeb-form-field">
          <span class="weeb-form-label" id="language-label">Language</span>
          <Select
            variant="field"
            icon={faGlobe}
            value={bloc.form.language}
            options={bloc.languages}
            ariaLabel="Language"
            onChange={(detail) => bloc.setLanguage(String(detail.value))}
          />
        </div>

        <!-- Public page customization -->
        <div class="pt-2">
          <h2 class="text-sm font-semibold text-weeb-fg mb-1">Your public page</h2>
          <p class="text-xs text-weeb-fg-muted mb-4">
            How <span class="font-mono">/u/{bloc.form.username || 'you'}</span> looks to anyone who visits.
          </p>

          <!-- The bio is a FormTextarea, which is FormInput given more than one
               line. Hand-rolled, it was a third field language on this form. -->
          <FormTextarea
            id="bio"
            name="bio"
            label="Bio"
            rows={2}
            maxlength={bloc.bioLimit}
            value={bloc.form.bio}
            onInput={(detail) => bloc.setField('bio', detail.value)}
            placeholder="A line about you"
          />

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
          <!-- The submit is the form's own; it no longer relies on a button
               with no type defaulting to one. -->
          <Button type="submit" loading={bloc.isSaving} className="flex-1">Save Changes</Button>
          <Button color="transparent" href="/profile">Cancel</Button>
        </div>
      </form>
    </div>
  </div>
{/if}
