import { create as baseCreate } from 'zustand';
import type { StateCreator } from 'zustand';
import { devtools } from 'zustand/middleware';

const isBrowser = typeof window !== 'undefined';
const isDev = isBrowser && (import.meta as any)?.env?.DEV !== false;

/**
 * Wraps a Zustand initializer with devtools (enabled only in the browser + dev).
 */
export function createStore<T>(
  name: string,
  initializer: StateCreator<T, [['zustand/devtools', never]], []>
) {
  const withDevtools = devtools(initializer, {
    name,                                  // show store name in Redux DevTools
    enabled: isDev,                        // avoid SSR/worker errors
  });
  return baseCreate<T>()(withDevtools);
}
