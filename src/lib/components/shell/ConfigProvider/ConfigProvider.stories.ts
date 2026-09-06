import type { Meta, StoryObj } from '@storybook/svelte';
import ConfigProviderDemo from '$lib/components/__stories__/ConfigProviderDemo.svelte';

/**
 * The app's config, put into Svelte context once so nothing has to fetch it.
 *
 * It renders its children and nothing else, so there is no surface to drive
 * with props -- what it is FOR is the value a child finds under the `config`
 * key. Both stories therefore mount the real provider around a real child
 * component (`ConfigContextProbe`) that reads that key during its own
 * initialisation, which is the only moment `getContext` answers; a snippet
 * passed as `children` runs on the story's behalf and would read the story's
 * context instead.
 */
type ConfigProviderArgs = { fallback?: boolean };

const meta = {
  title: 'Composites/App Shell/ConfigProvider',
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  render: (args: ConfigProviderArgs) => ({ Component: ConfigProviderDemo, props: args }),
} satisfies Meta<ConfigProviderArgs>;

export default meta;
type Story = StoryObj<ConfigProviderArgs>;

/** The normal case: the config the root layout hydrated, handed straight to a child. */
export const Hydrated: Story = {
  args: { fallback: false },
};

/**
 * The store empty when the provider read it -- a surface mounted before the
 * root layout ran. It still puts an object in context rather than `null`, which
 * is the difference between a CDN base going missing and every consumer that
 * reads a field off config throwing.
 */
export const FallbackConfig: Story = {
  args: { fallback: true },
};
