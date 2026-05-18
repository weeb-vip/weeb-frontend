import { writable } from 'svelte/store';

export const mobileDrawerOpen = writable(false);

export function openMobileDrawer() {
  mobileDrawerOpen.set(true);
}

export function closeMobileDrawer() {
  mobileDrawerOpen.set(false);
}
