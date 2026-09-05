import type { ActionReturn } from 'svelte/action';

/**
 * An element that may or may not exist yet. Menus are portalled to `<body>`
 * and only bound once they render, so a call site frequently holds `undefined`
 * at the moment it configures this action.
 */
export type MaybeElement = Element | null | undefined;

/** Either the elements themselves, or a getter read fresh on every event. */
export type IgnoreTargets = MaybeElement | MaybeElement[] | (() => MaybeElement | MaybeElement[]);

export interface ClickOutsideOptions {
  /** Called when a pointer event lands outside `node` and outside every ignored element. */
  handler: (event: Event) => void;
  /**
   * Which DOM event closes the surface. `click` matches the popover/dropdown
   * behaviour; `mousedown`/`pointerdown` close on press, which is what the
   * profile menu and `Select` do so a drag started outside dismisses at once.
   * @default 'click'
   */
  event?: 'click' | 'mousedown' | 'pointerdown';
  /**
   * Extra elements that count as "inside" even though they are not descendants
   * of `node`. Two cases need this: the trigger button (whose own click must
   * not immediately re-close what it just opened) and a menu portalled out to
   * `<body>` (a real descendant of nothing).
   */
  ignore?: IgnoreTargets;
  /**
   * While false the listener is not attached at all. Lets a call site keep the
   * action on a permanently mounted wrapper and gate it on `isOpen`, instead of
   * hand-rolling an add/removeEventListener pair in a reactive statement.
   * @default true
   */
  enabled?: boolean;
}

function toArray(targets: IgnoreTargets | undefined): MaybeElement[] {
  const resolved = typeof targets === 'function' ? targets() : targets;
  if (!resolved) return [];
  return Array.isArray(resolved) ? resolved : [resolved];
}

/**
 * The decision this action exists to make, split out as a pure function so the
 * rule can be unit tested without a DOM: is `target` outside `node` and outside
 * every ignored element?
 *
 * Anything that is not a Node (a click on the window, say) counts as outside.
 */
export function isOutside(target: unknown, node: MaybeElement, ignore?: IgnoreTargets): boolean {
  if (!node) return false;
  if (!target || typeof (target as Node).nodeType !== 'number') return true;
  const point = target as Node;
  if (node.contains(point)) return false;
  return !toArray(ignore).some((el) => !!el && el.contains(point));
}

/**
 * Dismiss-on-outside-click, in one place.
 *
 * `AnimeCalendarPopover`, `AnimeStatusDropdown` and `ProfileDropdown` each grew
 * their own version of this: a `handleClickOutside` that checks `contains()` on
 * two bound elements, plus an `addEventListener`/`removeEventListener` pair
 * driven either by a reactive statement (which leaks the listener if the
 * component is destroyed while open — hence the `beforeunload` patch in the
 * popover) or by `onMount`. They disagree on the event (`click` vs `mousedown`)
 * and on whether the trigger is exempt, which is why one of them closes and
 * reopens on the same click and another does not.
 *
 * This collapses all three: one listener, always removed on destroy, with the
 * trigger/portalled-menu exemptions expressed as data.
 *
 * ```svelte
 * <div use:clickOutside={{ handler: close, enabled: isOpen, ignore: () => menuEl }}>
 * ```
 */
export function clickOutside(
  node: HTMLElement,
  options: ClickOutsideOptions
): ActionReturn<ClickOutsideOptions> {
  // Actions never run during SSR, but guard anyway so importing and calling
  // this module on the server can never touch `document`.
  if (typeof document === 'undefined') {
    return {};
  }

  let current = options;
  let attachedAs: string | null = null;

  function onEvent(event: Event) {
    if (current.enabled === false) return;
    if (isOutside(event.target, node, current.ignore)) {
      current.handler(event);
    }
  }

  function attach() {
    const wanted = current.enabled === false ? null : (current.event ?? 'click');
    if (wanted === attachedAs) return;
    detach();
    if (wanted) {
      // Capture phase: a handler that calls stopPropagation() further down the
      // tree must not be able to strand the menu open.
      document.addEventListener(wanted, onEvent, true);
      attachedAs = wanted;
    }
  }

  function detach() {
    if (attachedAs) {
      document.removeEventListener(attachedAs, onEvent, true);
      attachedAs = null;
    }
  }

  attach();

  return {
    update(next: ClickOutsideOptions) {
      current = next;
      attach();
    },
    destroy() {
      detach();
    }
  };
}
