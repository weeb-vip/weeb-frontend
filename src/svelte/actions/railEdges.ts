/**
 * Marks a rail wrapper with how far its shelf is scrolled, so the edge fades can
 * tell the truth.
 *
 * A permanently-painted right fade is a lie at the end of the shelf, and a lie on
 * a wide screen where every card already fits. Both are worse than no affordance:
 * they train the reader to ignore the one signal that says "there is more here".
 * So the state is measured rather than assumed, and the fades key off it.
 *
 * Applied to the wrapper, not the scroller, so the attributes land on the element
 * that paints the fades and no :has() is required.
 */
export function railEdges(wrapper: HTMLElement) {
  const rail = wrapper.querySelector<HTMLElement>('[data-rail]') ?? wrapper.firstElementChild as HTMLElement | null;
  if (!rail) return {};

  // A sub-pixel tolerance: fractional scroll widths from zoom and fractional
  // device pixels otherwise leave the end fade painted a hair short of the end.
  const EPSILON = 2;

  const measure = () => {
    const max = rail.scrollWidth - rail.clientWidth;
    const x = rail.scrollLeft;
    // Custom properties rather than data attributes: the fades are styled inside
    // a Svelte component, and a selector that only ever matches at runtime gets
    // pruned as unused at compile time.
    wrapper.style.setProperty('--rail-fade-start', x > EPSILON ? '1' : '0');
    wrapper.style.setProperty('--rail-fade-end', max > EPSILON && x < max - EPSILON ? '1' : '0');
  };

  // Measured synchronously rather than coalesced into requestAnimationFrame:
  // three geometry reads and two custom-property writes are cheaper than the
  // bookkeeping, and rAF never runs in a background tab, which would leave the
  // fades describing a scroll position the shelf no longer holds.
  measure();
  rail.addEventListener('scroll', measure, { passive: true });

  // Viewport changes and font loading move the shelf's own box.
  const resize = new ResizeObserver(measure);
  resize.observe(rail);

  // Cards arriving from the query do not. A scroll container's border-box is
  // unchanged by content overflowing it, so ResizeObserver alone never fires for
  // the load that matters most: SSR renders an empty shelf, the query resolves,
  // ten cards appear, and the shelf silently becomes scrollable with no end fade
  // to say so. Watch the child list for that.
  const mutation = new MutationObserver(measure);
  mutation.observe(rail, { childList: true });

  return {
    destroy() {
      rail.removeEventListener('scroll', measure);
      resize.disconnect();
      mutation.disconnect();
    }
  };
}
