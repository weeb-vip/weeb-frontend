import type { Meta, StoryObj } from '@storybook/svelte';
import { faEnvelope, faUser } from '@fortawesome/free-solid-svg-icons';
import FormInput from '../FormInput.svelte';
import StoryContainer from './StoryContainer.svelte';

const meta = {
  title: 'Design System/FormInput',
  component: FormInput,
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
  argTypes: {
    type: {
      control: 'select',
      options: ['text', 'email', 'password'],
    },
  },
} satisfies Meta<typeof FormInput>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A labelled, empty text field -- the shape every form field starts from. */
export const Default: Story = {
  args: {
    id: 'username',
    name: 'username',
    label: 'Username',
    placeholder: 'your_username',
  },
};

/** A leading icon, which insets the text so the two never collide. */
export const WithIcon: Story = {
  args: {
    id: 'email',
    name: 'email',
    type: 'email',
    label: 'Email address',
    placeholder: 'you@example.com',
    icon: faEnvelope,
  },
};

/** Password with the reveal toggle; the eye button sits inside the field. */
export const Password: Story = {
  args: {
    id: 'password',
    name: 'password',
    type: 'password',
    label: 'Password',
    placeholder: 'At least 6 characters',
    value: 'hunter2hunter2',
    showPasswordToggle: true,
  },
};

/** Invalid: a red border, a tinted ground, and the message wired up via aria-describedby. */
export const WithError: Story = {
  args: {
    id: 'username-error',
    name: 'username',
    label: 'Username',
    value: 'a',
    error: 'Username must be at least 3 characters',
  },
};

/** Disabled: dimmed and not focusable, with both the icon and toggle inert. */
export const Disabled: Story = {
  args: {
    id: 'disabled',
    name: 'disabled',
    label: 'Username',
    value: 'locked_account',
    icon: faUser,
    disabled: true,
  },
};

/** No `label`: the element is omitted entirely and only the placeholder remains. */
export const WithoutLabel: Story = {
  args: {
    id: 'search',
    name: 'search',
    placeholder: 'Search anime...',
  },
};
