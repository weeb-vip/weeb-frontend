import type { Meta, StoryObj } from '@storybook/svelte';
import { faGlobe } from '@fortawesome/free-solid-svg-icons';
import Select from './Select.svelte';
import StoryContainer from '$lib/components/__stories__/StoryContainer.svelte';

const STATUSES = [
  { value: '', label: 'Any status' },
  { value: 'FINISHED', label: 'Finished' },
  { value: 'CURRENTLY_AIRING', label: 'Currently airing' },
  { value: 'NOT_YET_AIRED', label: 'Not yet aired' },
];

const meta = {
  title: 'Primitives/Select',
  component: Select,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    align: {
      control: 'inline-radio',
      options: ['left', 'right'],
    },
    variant: {
      control: 'inline-radio',
      options: ['pill', 'field'],
    },
  },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Closed, with a value selected -- the trigger keeps the native pill's measurements. */
export const Default: Story = {
  args: {
    value: 'CURRENTLY_AIRING',
    options: STATUSES,
    ariaLabel: 'Filter by status',
  },
};

/** Nothing matches `value`, so the placeholder stands in -- e.g. a cleared filter. */
export const Placeholder: Story = {
  args: {
    value: 'NOT_A_REAL_VALUE',
    options: STATUSES,
    placeholder: 'Any status',
    ariaLabel: 'Filter by status',
  },
};

/** No options to offer: the trigger still renders, and opening it shows an empty menu. */
export const NoOptions: Story = {
  args: {
    value: '',
    options: [],
    placeholder: 'No filters available',
    ariaLabel: 'Filter by status',
  },
};

/** Disabled: dimmed, not focusable, and it refuses to open. */
export const Disabled: Story = {
  args: {
    value: 'FINISHED',
    options: STATUSES,
    ariaLabel: 'Filter by status',
    disabled: true,
  },
};

/** A label longer than the pill: it ellipsises rather than pushing the chevron off. */
export const LongLabel: Story = {
  args: {
    value: 'long',
    options: [
      { value: 'long', label: 'Sorted by score, then by member count, descending' },
    ],
    ariaLabel: 'Sort results',
    className: 'max-w-[200px]',
  },
};

/** Right-aligned: the menu lines up with the trigger's right edge when it opens. */
export const RightAligned: Story = {
  args: {
    value: 'FINISHED',
    options: STATUSES,
    ariaLabel: 'Filter by status',
    align: 'right',
  },
};

/**
 * The `field` variant: FormInput's 44px / radius-8 / 15px / 1.5px border, so a
 * Select can sit in a form row without the row growing a second field shape.
 * The settings form kept a native <select> -- white OS menu and all -- because
 * until this existed the only thing on offer was a 32px filter pill.
 */
export const FieldVariant: Story = {
  args: {
    variant: 'field',
    value: 'en',
    options: [
      { value: 'en', label: 'English' },
      { value: 'ja', label: '日本語' },
      { value: 'es', label: 'Español' },
    ],
    ariaLabel: 'Language',
  },
  decorators: [() => ({ Component: StoryContainer, props: { width: '360px' } })],
};

/** A leading icon inside the control, the way FormInput carries one. */
export const FieldWithIcon: Story = {
  args: {
    variant: 'field',
    icon: faGlobe,
    value: 'en',
    options: [
      { value: 'en', label: 'English' },
      { value: 'ja', label: '日本語' },
    ],
    ariaLabel: 'Language',
  },
  decorators: [() => ({ Component: StoryContainer, props: { width: '360px' } })],
};

/** A field with nothing chosen yet: the placeholder stands in at field scale. */
export const FieldPlaceholder: Story = {
  args: {
    variant: 'field',
    value: '',
    options: [
      { value: 'en', label: 'English' },
      { value: 'ja', label: '日本語' },
    ],
    placeholder: 'Choose a language',
    ariaLabel: 'Language',
  },
  decorators: [() => ({ Component: StoryContainer, props: { width: '360px' } })],
};
