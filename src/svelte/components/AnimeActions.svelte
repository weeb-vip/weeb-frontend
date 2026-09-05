<script lang="ts">
  import Button from './Button.svelte';
  import AnimeStatusDropdown from './AnimeStatusDropdown.svelte';
  import { AnimeActionsBloc } from './AnimeActions.bloc.svelte';

  let {
    anime,
    variant = 'default',
    className = '',
    showLabel = true,
    bloc: injected
  }: {
    anime: any;
    variant?: 'default' | 'icon-only' | 'hero' | 'compact';
    className?: string;
    showLabel?: boolean;
    bloc?: AnimeActionsBloc;
  } = $props();

  // The bloc reads `anime` through a getter, so it always sees the current prop
  // without the view pushing it in.
  const ownBloc = new AnimeActionsBloc({
    get anime() {
      return anime;
    }
  });
  const bloc = $derived(injected ?? ownBloc);

  // Mutations are created after mount, as they were under onMount: they read
  // the query client off Svelte's context, which is not available to a bloc
  // constructed at module scope in a story.
  $effect(() => bloc.init());
</script>

{#if bloc.isInList}
  <!-- Show status dropdown for anime already in list -->
  <AnimeStatusDropdown
    entry={bloc.dropdownEntry}
    {variant}
    onStatusChange={(detail) => bloc.changeStatus(detail)}
    onDelete={(detail) => bloc.removeFromList(detail)}
  />
{:else}
  <!-- Show add button for anime not in list -->
  {#if variant === 'icon-only'}
    <Button
      color="blue"
      icon='<i class="fas fa-plus w-3 h-3" style="display: flex; align-items: center; justify-content: center; line-height: 1;"></i>'
      showLabel={false}
      status={bloc.buttonStatus}
      onClick={() => bloc.addToList()}
      className="w-8 h-8 rounded-full flex items-center justify-center p-0 {className}"
    />
  {:else if variant === 'hero'}
    <Button
      color="transparent"
      label="Add to List"
      showLabel={true}
      status={bloc.buttonStatus}
      onClick={() => bloc.addToList()}
      className="px-4 py-2 text-base font-semibold text-white hover:bg-weeb-surface hover:text-black focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black transition {className}"
    />
  {:else if variant === 'compact'}
    <Button
      color="blue"
      label="Add to list"
      showLabel={showLabel}
      status={bloc.buttonStatus}
      className="w-fit px-2 py-1 text-xs {className}"
      onClick={() => bloc.addToList()}
    />
  {:else}
    <!-- Default button variant -->
    <Button
      color="blue"
      label="Add to list"
      showLabel={showLabel}
      status={bloc.buttonStatus}
      className={className}
      onClick={() => bloc.addToList()}
    />
  {/if}
{/if}
