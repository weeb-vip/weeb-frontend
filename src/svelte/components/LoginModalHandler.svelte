<script lang="ts">
  import Modal from './Modal.svelte';
  import LoginRegisterModal from './LoginRegisterModal.svelte';
  import QueryProvider from './QueryProvider.svelte';
  import { LoginModalHandlerBloc } from './LoginModalHandler.bloc.svelte';

  /**
   * The app-wide auth modal. Mounted once by the header; opened from anywhere
   * by the `openLogin` / `openRegister` window events.
   */
  let { bloc = new LoginModalHandlerBloc() }: { bloc?: LoginModalHandlerBloc } = $props();

  // The listeners come back out of the bloc as a teardown, so they never
  // outlive the component the way the old async onMount ones did.
  $effect(() => bloc.listen());
</script>

<!-- Modal renders its children only once open and mounted, so the query client
     is created the first time someone actually asks to sign in -- not on every
     page load, and never during SSR. -->
<Modal isOpen={bloc.isOpen} onClose={() => bloc.close()}>
  <QueryProvider>
    <LoginRegisterModal closeFn={() => bloc.close()} />
  </QueryProvider>
</Modal>
