/**
 * Open/closed for the desktop profile menu.
 *
 * Small, but it is state that outlives a render and it is what a story needs
 * to drive: without the seam the open menu can only be reached by clicking,
 * which a static story cannot do.
 *
 * Dismiss-on-outside-click is NOT here -- that is `use:clickOutside` in the
 * view, which is the DOM's business. The bloc only owns the flag.
 */
export class ProfileDropdownBloc {
  #isOpen = $state(false);

  constructor(initialOpen = false) {
    this.#isOpen = initialOpen;
  }

  get isOpen(): boolean {
    return this.#isOpen;
  }

  toggle(): void {
    this.#isOpen = !this.#isOpen;
  }

  close(): void {
    this.#isOpen = false;
  }
}
