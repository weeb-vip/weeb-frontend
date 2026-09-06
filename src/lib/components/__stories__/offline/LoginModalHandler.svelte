<script lang="ts">
  /**
   * Storybook's stand-in for LoginModalHandler (see ./README.md).
   *
   * The real one builds a QueryClient on mount and subscribes to the login
   * modal store. With the modal closed -- which is every Header story -- it
   * draws nothing, so nothing is what this draws. The modal itself has its own
   * story (`Composites/Auth/LoginRegisterModal`).
   */
</script>
