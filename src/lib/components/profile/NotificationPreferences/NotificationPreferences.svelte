<script lang="ts">
  import Skeleton from '$lib/components/primitives/Skeleton';
  import { NotificationPreferencesBloc } from './NotificationPreferences.bloc.svelte';

  let { bloc = new NotificationPreferencesBloc() }: { bloc?: NotificationPreferencesBloc } = $props();
</script>

<section class="bg-weeb-surface shadow rounded-lg p-6 mt-6" aria-labelledby="notification-preferences-title">
  <h2 id="notification-preferences-title" class="text-lg font-semibold text-weeb-fg">Notifications</h2>
  <p class="text-sm text-weeb-fg-muted mt-1">
    Where each kind of notification reaches you. In-app notifications live under the bell; push and email arrive once those are set up.
  </p>

  {#if bloc.isLoading}
    <div class="mt-4 space-y-3">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  {:else}
    <table class="prefs mt-4 w-full">
      <thead>
        <tr>
          <th scope="col" class="text-left text-xs font-medium text-weeb-fg-muted pb-2">Notify me when</th>
          {#each bloc.channels as channel (channel.channel)}
            <th scope="col" class="text-center text-xs font-medium text-weeb-fg-muted pb-2 w-20">{channel.label}</th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each bloc.types as row (row.type)}
          <tr class="border-t border-weeb-border">
            <th scope="row" class="text-left py-3 pr-4 font-normal">
              <span class="block text-sm font-medium text-weeb-fg-secondary">{row.label}</span>
              <span class="block text-xs text-weeb-fg-muted">{row.detail}</span>
            </th>
            {#each bloc.channels as channel (channel.channel)}
              {@const on = bloc.isEnabled(row.type, channel.channel)}
              <td class="text-center py-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={`${row.label}: ${channel.label}`}
                  disabled={bloc.isSaving(row.type, channel.channel) || !bloc.isReady}
                  onclick={() => bloc.toggle(row.type, channel.channel)}
                  class="relative inline-block w-11 h-6 rounded-full transition-colors disabled:opacity-60 {on ? 'bg-weeb-accent' : 'bg-weeb-surface-hover'}"
                >
                  <span class="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform {on ? 'translate-x-5' : ''}"></span>
                </button>
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</section>
