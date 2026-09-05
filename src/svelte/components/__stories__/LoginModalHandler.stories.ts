import type { Meta, StoryObj } from '@storybook/svelte';
import { writable } from 'svelte/store';
import LoginModalHandler from '../LoginModalHandler.svelte';
import {
  LoginModalHandlerBloc,
  type AuthPromptEventsPort,
  type LoginModalPort,
} from '../LoginModalHandler.bloc.svelte';

/** No window listeners: a story must not arm the Storybook shell's globals. */
const noEvents: AuthPromptEventsPort = { listen: () => () => {} };

function stubModal(open: boolean, register = false): LoginModalPort {
  const state = writable({ isOpen: open, register });

  return {
    subscribe: state.subscribe,
    openLogin: () => state.set({ isOpen: true, register: false }),
    openRegister: () => state.set({ isOpen: true, register: true }),
    close: () => state.set({ isOpen: false, register: false }),
  };
}

function bloc(open: boolean, register = false) {
  return new LoginModalHandlerBloc({ modal: stubModal(open, register), events: noEvents });
}

const meta = {
  title: 'Composites/App Shell/LoginModalHandler',
  component: LoginModalHandler,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof LoginModalHandler>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Open on the login form. The panel portals to `<body>`, so it appears over the
 * whole preview rather than inside the story frame -- that is what it does in
 * the app too.
 */
export const Open: Story = {
  args: {
    bloc: bloc(true),
  },
};

/** Opened by `openRegister`: the same surface, showing the register side. */
export const OpenOnRegister: Story = {
  args: {
    bloc: bloc(true, true),
  },
};

/**
 * Closed, which is the state it spends nearly all its life in: nothing renders,
 * and the query client under it is never even built.
 */
export const Closed: Story = {
  args: {
    bloc: bloc(false),
  },
};
