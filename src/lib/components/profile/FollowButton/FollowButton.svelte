<script lang="ts">
  import Button from '$lib/components/primitives/Button';
  import { FollowButtonBloc, type FollowTarget } from './FollowButton.bloc.svelte';

  let {
    target,
    onFollowerCountChange = () => {},
    bloc = new FollowButtonBloc({ source: () => target, onFollowerCountChange }),
    className = '',
  }: {
    target: FollowTarget;
    onFollowerCountChange?: (delta: number) => void;
    bloc?: FollowButtonBloc;
    className?: string;
  } = $props();
</script>

{#if bloc.isVisible}
  <Button
    size="sm"
    color={bloc.isActive ? 'transparent' : 'blue'}
    loading={bloc.isPending}
    ariaLabel={bloc.ariaLabel}
    onClick={() => bloc.toggle()}
    className="follow-button {bloc.isActive ? 'follow-button--active' : ''} {className}"
  >
    {bloc.label}
  </Button>
{/if}

<style>
  :global(.follow-button--active) {
    border: 1px solid var(--weeb-border);
  }
</style>
