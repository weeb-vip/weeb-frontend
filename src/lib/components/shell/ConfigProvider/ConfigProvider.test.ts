import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import ConfigProvider from './ConfigProvider.svelte';
import ProviderHarness from '../../__tests__/ProviderHarness.svelte';
import ContextProbe from '../../__tests__/ContextProbe.svelte';
import { configStore } from '$lib/stores/config';
import type { IConfig } from '../../../../config/interfaces';

/**
 * A provider renders none of its own markup, so what is tested is what it
 * guarantees: `config` is in Svelte context by the time a child initialises,
 * it is the config the root layout already hydrated rather than a re-fetch,
 * and there is something usable there even when nothing hydrated the store.
 *
 * `getContext` only answers during a component's own initialisation, so the
 * reader is a real child component (`ContextProbe` via `ProviderHarness`) --
 * a `createRawSnippet` handed over as `children` runs on this file's behalf
 * and would read the test's context, not the provider's.
 */

const child = (text: string) => createRawSnippet(() => ({ render: () => `<p>${text}</p>` }));

const CONFIG = {
  cdn_url: 'https://cdn.example.test',
  cdn_user_url: 'https://cdn.example.test/users'
} as IConfig;

/** Reads the config a child of ConfigProvider would see. */
function configSeenByChild(): IConfig | undefined {
  const onValue = vi.fn();
  render(ProviderHarness, {
    props: {
      provider: ConfigProvider,
      probe: ContextProbe,
      probeProps: { contextKey: 'config', onValue }
    }
  });

  expect(onValue).toHaveBeenCalledTimes(1);
  return onValue.mock.calls[0][0] as IConfig | undefined;
}

afterEach(() => {
  // The store is a module singleton, so a test that populated it hands it back.
  configStore.setConfig(null as unknown as IConfig);
});

describe('ConfigProvider', () => {
  it('renders its children', () => {
    render(ConfigProvider, { props: { children: child('the app') } });

    expect(screen.getByText('the app')).toBeInTheDocument();
  });

  it('is context and nothing else -- with no children it renders no markup', () => {
    const { container } = render(ConfigProvider);

    expect(container.textContent).toBe('');
  });

  it('hands a child the config the layout hydrated', () => {
    configStore.setConfig(CONFIG);

    expect(configSeenByChild()).toEqual(CONFIG);
    expect(screen.getByTestId('context-probe')).toBeInTheDocument();
  });

  /**
   * Nothing hydrated the store -- a surface mounted before the root layout ran.
   * The provider must still put something in context: `null` there would take
   * out every consumer that reads a field off it.
   */
  it('falls back to a usable config when the store is empty', () => {
    const config = configSeenByChild();

    expect(config).toBeTruthy();
    expect(config?.cdn_user_url).toBe('https://cdn.weeb.vip/users');
  });

  /**
   * The comment on the component is explicit that this must not re-fetch
   * `/config.json`: the layout already has the build-time config, and a second
   * request per provider was what this replaced.
   */
  it('never reaches for the network', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    configStore.setConfig(CONFIG);

    configSeenByChild();

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
