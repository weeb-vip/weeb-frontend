import type { Meta, StoryObj } from '@storybook/svelte';
import Register from '../../../routes/auth/register/+page.svelte';
import { RegisterBloc } from '../Register.bloc.svelte';
import type { RegisterPort } from '../auth-shared';
import { failsWith, pending } from './auth-stubs';

function registerBloc(options: {
  register?: RegisterPort;
  password?: string;
  fill?: boolean;
  submit?: boolean;
} = {}) {
  const bloc = new RegisterBloc({
    register: options.register ?? (async () => ({ id: 'user-1' })),
    navigate: () => {}
  });

  if (options.fill || options.submit) {
    bloc.updateField('username', 'kaori@example.com');
    bloc.updateField('password', options.password ?? 'hunter22');
    bloc.updateField('confirmPassword', options.password ?? 'hunter22');
  } else if (options.password) {
    bloc.updateField('password', options.password);
  }

  if (options.submit) void bloc.submit();

  return bloc;
}

const meta = {
  title: 'Pages/Register',
  component: Register,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' }
} satisfies Meta<typeof Register>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Empty, with the line that makes the check-email screen expected. */
export const Idle: Story = {
  args: { bloc: registerBloc() }
};

/** Submitted empty: all three fields say what they need, none of them shout. */
export const ValidationErrors: Story = {
  args: {
    bloc: (() => {
      const bloc = registerBloc();
      void bloc.submit();
      return bloc;
    })()
  }
};

/** Passwords that don't match -- caught here rather than by the server. */
export const PasswordsDoNotMatch: Story = {
  args: {
    bloc: (() => {
      const bloc = registerBloc();
      bloc.updateField('username', 'kaori@example.com');
      bloc.updateField('password', 'hunter22');
      bloc.updateField('confirmPassword', 'hunter33');
      void bloc.submit();
      return bloc;
    })()
  }
};

/** Six characters, nothing else: the meter's first bar and no more. */
export const WeakPassword: Story = {
  args: { bloc: registerBloc({ password: 'hunter' }) }
};

/** Length plus a capital gets to the middle of the meter. */
export const MediumPassword: Story = {
  args: { bloc: registerBloc({ password: 'Hunter22' }) }
};

/** Long, mixed case, digits and a symbol -- the top of the meter. */
export const StrongPassword: Story = {
  args: { bloc: registerBloc({ password: 'Hunter22!Frieren' }) }
};

/** In flight: the button locks so a double-tap can't create two accounts. */
export const Submitting: Story = {
  args: { bloc: registerBloc({ register: pending, submit: true }) }
};

/** The address is taken. The banner names the cause and the way out of it. */
export const ServerError: Story = {
  args: {
    bloc: registerBloc({ register: failsWith('user already exists'), submit: true })
  }
};
