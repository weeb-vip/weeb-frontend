import { readable } from 'svelte/store';

/**
 * True on phone-width viewports.
 *
 * Kept as a store rather than a per-component matchMedia because more than one
 * surface now needs the same answer, and two components disagreeing about where
 * "phone" starts is the kind of drift that shows up as one element reflowing a
 * breakpoint before its neighbour.
 *
 * SSR has no viewport, so the server always renders the wider layout and the
 * client corrects on hydration. That ordering is deliberate: the wide layout is
 * the one whose markup is a superset, so narrowing on the client removes nodes
 * rather than adding them.
 */
/**
 * These must stay in lockstep with the CSS breakpoints in the components that
 * read them. A store tier ending one pixel apart from its media query puts the
 * tablet item count against the phone column count -- twelve cards in two
 * columns, which measured as a 12,414px page at exactly 768px.
 */
export const PHONE_QUERY = '(max-width: 767px)';
export const TABLET_QUERY = '(min-width: 768px) and (max-width: 1199px)';

function media(query: string) {
  return readable(false, set => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mq = window.matchMedia(query);
    set(mq.matches);

    const onChange = (event: MediaQueryListEvent) => set(event.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  });
}

export const isPhone = media(PHONE_QUERY);

/**
 * Tablets need their own tier because column count, not width, decides how many
 * rows a shelf costs. At 768px a grid fits four columns, so a twenty-item shelf
 * is five rows -- longer than the same shelf on a phone, which is the opposite
 * of what the breakpoint suggests.
 */
export const isTablet = media(TABLET_QUERY);
