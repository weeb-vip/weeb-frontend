import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { faEnvelope } from '@fortawesome/free-solid-svg-icons';
import FormInput from './FormInput.svelte';

/**
 * The field. Its recipe lives in `design-tokens.css`, which jsdom never loads,
 * so nothing here asserts a colour or a border -- what it asserts is the
 * label/input association, the described-by wiring, and the `has-error` class
 * the red state is keyed on. That class is the contract the AuthCard
 * specificity bug broke, so it is checked as a class deliberately.
 */

const base = { id: 'email', name: 'email' };

describe('FormInput', () => {
  it('associates its label with the input, so the field is reachable by name', () => {
    render(FormInput, { props: { ...base, label: 'Email address' } });

    const input = screen.getByLabelText('Email address');
    expect(input).toHaveAttribute('id', 'email');
    expect(input).toHaveAttribute('name', 'email');
  });

  it('renders without a label, named by its placeholder', () => {
    render(FormInput, { props: { ...base, placeholder: 'you@example.com' } });

    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
  });

  it('reports each keystroke with the new value and the raw event', async () => {
    const onInput = vi.fn();
    render(FormInput, { props: { ...base, label: 'Email', onInput } });

    await userEvent.type(screen.getByLabelText('Email'), 'hi');

    expect(onInput).toHaveBeenCalledTimes(2);
    const last = onInput.mock.calls.at(-1)?.[0];
    expect(last.value).toBe('hi');
    expect(last.originalEvent.target).toBe(screen.getByLabelText('Email'));
  });

  it('is inert when disabled', async () => {
    const onInput = vi.fn();
    render(FormInput, { props: { ...base, label: 'Email', disabled: true, onInput } });

    const input = screen.getByLabelText('Email');
    expect(input).toBeDisabled();
    expect(input).toHaveClass('is-disabled');

    await userEvent.type(input, 'hi');
    expect(onInput).not.toHaveBeenCalled();
  });

  it('marks a required field required', () => {
    render(FormInput, { props: { ...base, label: 'Email', required: true } });

    expect(screen.getByLabelText('Email')).toBeRequired();
  });

  it('carries the type it was given', () => {
    render(FormInput, { props: { ...base, label: 'Password', type: 'password' } });

    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
  });

  describe('the error state', () => {
    it('shows the message and points the input at it', () => {
      render(FormInput, {
        props: { ...base, label: 'Email', error: 'Enter a valid email address' }
      });

      const input = screen.getByLabelText('Email');
      const message = screen.getByText('Enter a valid email address');

      expect(message).toHaveAttribute('id', 'email-error');
      expect(input).toHaveAttribute('aria-describedby', 'email-error');
      expect(input).toHaveAccessibleDescription('Enter a valid email address');
    });

    /**
     * The class the red border, tint and ring are all keyed on. It is asserted
     * as a class because it IS the contract: `AuthCard` used to declare
     * `.card-body :global(input[type='email'])` at specificity (0,2,1), which
     * beat `.weeb-form-input.has-error` at (0,2,0) and silently erased the red
     * on every auth page. See AuthCard.test.ts for the other half of that pin.
     */
    it('flags the input with has-error, alongside the shared field class', () => {
      render(FormInput, { props: { ...base, label: 'Email', error: 'Required' } });

      expect(screen.getByLabelText('Email')).toHaveClass('weeb-form-input', 'has-error');
    });

    it('carries neither the class nor the description when there is no error', () => {
      render(FormInput, { props: { ...base, label: 'Email' } });

      const input = screen.getByLabelText('Email');
      expect(input).not.toHaveClass('has-error');
      expect(input).not.toHaveAttribute('aria-describedby');
    });
  });

  describe('the password toggle', () => {
    it('flips the input between password and text', async () => {
      render(FormInput, {
        props: { ...base, id: 'pw', name: 'pw', label: 'Password', type: 'password', showPasswordToggle: true }
      });

      const input = screen.getByLabelText('Password');
      expect(input).toHaveAttribute('type', 'password');

      const toggle = document.querySelector('.weeb-password-toggle') as HTMLButtonElement;
      await userEvent.click(toggle);

      expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');

      await userEvent.click(toggle);
      expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
    });

    /**
     * The toggle's only content is a decorative FontAwesome SVG, so without an
     * `aria-label` it announced as a bare "button" and there was no non-visual
     * way to tell what it did -- let alone to reveal the password.
     */
    it('names itself for a screen reader', () => {
      render(FormInput, {
        props: { ...base, id: 'pw', name: 'pw', label: 'Password', type: 'password', showPasswordToggle: true }
      });

      expect(screen.getByRole('button', { name: /password/i })).toBeInTheDocument();
    });

    it('names the state the press moves to, not the state it is in', () => {
      render(FormInput, {
        props: { ...base, id: 'pw', name: 'pw', label: 'Password', type: 'password', showPasswordToggle: true }
      });

      // Hidden to begin with, so the press ahead is "show".
      expect(screen.getByRole('button', { name: 'Show password' })).toBeInTheDocument();
    });

    it('keeps its name honest once the password is showing', async () => {
      render(FormInput, {
        props: { ...base, id: 'pw', name: 'pw', label: 'Password', type: 'password', showPasswordToggle: true }
      });

      await userEvent.click(screen.getByRole('button', { name: 'Show password' }));

      // A name that still said "Show password" over a visible password would be
      // worse than none: it would describe the opposite of what the press does.
      expect(screen.getByRole('button', { name: 'Hide password' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Show password' })).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Hide password' }));

      expect(screen.getByRole('button', { name: 'Show password' })).toBeInTheDocument();
    });

    it('draws no toggle at all when the field does not ask for one', () => {
      render(FormInput, { props: { ...base, id: 'pw', name: 'pw', label: 'Password', type: 'password' } });

      expect(screen.queryByRole('button', { name: /password/i })).not.toBeInTheDocument();
    });
  });

  it('renders a leading icon', () => {
    const { container } = render(FormInput, {
      props: { ...base, label: 'Email', icon: faEnvelope }
    });

    expect(container.querySelector('.weeb-input-icon-left')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveClass('has-icon');
  });
});
