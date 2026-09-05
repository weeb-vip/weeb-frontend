import type { Meta, StoryObj } from '@storybook/svelte';
import FormTextarea from './FormTextarea.svelte';
import StoryContainer from '$lib/components/__stories__/StoryContainer.svelte';

const meta = {
  title: 'Primitives/FormTextarea',
  component: FormTextarea,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  decorators: [
    () => ({
      Component: StoryContainer,
      props: { width: '360px' },
    }),
  ],
} satisfies Meta<typeof FormTextarea>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The same field FormInput draws, given more than one line. */
export const Default: Story = {
  args: {
    id: 'bio',
    name: 'bio',
    label: 'Bio',
    rows: 2,
    placeholder: 'A line about you',
  },
};

/** With a value, and the counter the `maxlength` cap turns on. */
export const WithCount: Story = {
  args: {
    id: 'bio',
    name: 'bio',
    label: 'Bio',
    rows: 2,
    maxlength: 140,
    value: 'Watching more than I finish. Currently on a long isekai detour.',
  },
};

/** Invalid: the red border and the shared red tint, same as FormInput's. */
export const WithError: Story = {
  args: {
    id: 'bio',
    name: 'bio',
    label: 'Bio',
    rows: 2,
    maxlength: 140,
    value: 'Not this.',
    error: 'That is not something we can publish.',
  },
};

/** Disabled: dimmed and not editable, at the same 0.5 every other control uses. */
export const Disabled: Story = {
  args: {
    id: 'bio',
    name: 'bio',
    label: 'Bio',
    rows: 2,
    value: 'Sign in to edit your bio.',
    disabled: true,
  },
};

/** Taller: `rows` is the only thing that decides how many lines it starts at. */
export const Tall: Story = {
  args: {
    id: 'notes',
    name: 'notes',
    label: 'Notes',
    rows: 6,
    placeholder: 'Anything worth remembering about this show',
  },
};
