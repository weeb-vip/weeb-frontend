<script lang="ts">
  import { readable } from 'svelte/store';
  import UserProfileWrapper from '../../UserProfileWrapper.svelte';
  import {
    UserProfileWrapperBloc,
    type AuthPort,
    type UserQueryPort,
  } from '../../UserProfileWrapper.bloc.svelte';

  /**
   * Storybook's stand-in for UserProfileHandler (see ./README.md).
   *
   * The real one exists only to stand up a QueryClient around
   * UserProfileWrapper. That wrapper is the part with a surface, and its bloc
   * already takes every dependency as a port -- so this renders the real
   * component with stub ports rather than a fake of it, and the header's
   * right-hand cluster in a story is the one the app draws.
   *
   * Signed out, which is what a visitor sees and the state with the most in it:
   * the Login and Register pair, including the accent button the overlay bar's
   * contrast rules single out.
   */
  let {
    isMobile = false,
    onProfileClick = null,
  }: {
    isMobile?: boolean;
    onProfileClick?: (() => void) | null;
  } = $props();

  const auth: AuthPort = readable({ isLoggedIn: false });
  const userQuery: UserQueryPort = readable({ data: null, isLoading: false, isError: false });

  const bloc = new UserProfileWrapperBloc({
    auth,
    userQuery,
    drawer: { open: () => {} },
    prompt: { requestLogin: () => {}, requestRegister: () => {} },
  });
</script>

<UserProfileWrapper {isMobile} {onProfileClick} {bloc} />
