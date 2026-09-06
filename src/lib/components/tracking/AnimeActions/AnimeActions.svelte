<script lang="ts">
  import { faPlus } from '@fortawesome/free-solid-svg-icons';
  import Button from '$lib/components/primitives/Button';
  import AnimeStatusDropdown from '$lib/components/tracking/AnimeStatusDropdown';
  import {
    AnimeActionsBloc,
    buttonColorFor,
    buttonSizeFor,
    type AnimeActionsVariant
  } from './AnimeActions.bloc.svelte';

  let {
    anime,
    variant = 'default',
    className = '',
    showLabel = true,
    bloc: injected
  }: {
    anime: any;
    variant?: AnimeActionsVariant;
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

  const isIconOnly = $derived(variant === 'icon-only');
  const buttonSize = $derived(buttonSizeFor(variant));
  const buttonColor = $derived(buttonColorFor(variant));

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
  <!-- Show add button for anime not in list.
       One Button: the variant picks a real size and colour rather than a stack
       of utility classes. It used to reach through `className` to override the
       variant's colour, its font size and -- worst -- the app's accent focus
       ring, replacing it with a white one. -->
  <Button
    color={buttonColor}
    size={buttonSize}
    icon={isIconOnly ? faPlus : null}
    ariaLabel={isIconOnly ? 'Add to list' : undefined}
    status={bloc.buttonStatus}
    onClick={() => bloc.addToList()}
    className={className}
  >
    {#if !isIconOnly && showLabel}
      {variant === 'hero' ? 'Add to List' : 'Add to list'}
    {/if}
  </Button>
{/if}
