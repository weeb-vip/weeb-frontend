import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import FormTextarea from './FormTextarea.svelte';

/** FormInput, given more than one line -- and the same wiring to prove. */

const base = { id: 'bio', name: 'bio' };

describe('FormTextarea', () => {
  it('associates its label with the textarea', () => {
    render(FormTextarea, { props: { ...base, label: 'About you' } });

    const field = screen.getByLabelText('About you');
    expect(field.tagName).toBe('TEXTAREA');
    expect(field).toHaveAttribute('id', 'bio');
  });

  it('renders the number of lines it was asked for', () => {
    render(FormTextarea, { props: { ...base, label: 'About you', rows: 6 } });

    expect(screen.getByLabelText('About you')).toHaveAttribute('rows', '6');
  });

  it('reports each keystroke', async () => {
    const onInput = vi.fn();
    render(FormTextarea, { props: { ...base, label: 'About you', onInput } });

    await userEvent.type(screen.getByLabelText('About you'), 'hey');

    expect(onInput).toHaveBeenCalledTimes(3);
    expect(onInput.mock.calls.at(-1)?.[0].value).toBe('hey');
  });

  it('is inert when disabled', async () => {
    const onInput = vi.fn();
    render(FormTextarea, { props: { ...base, label: 'About you', disabled: true, onInput } });

    const field = screen.getByLabelText('About you');
    expect(field).toBeDisabled();
    expect(field).toHaveClass('is-disabled');

    await userEvent.type(field, 'hey');
    expect(onInput).not.toHaveBeenCalled();
  });

  describe('the counter', () => {
    it('appears only with a cap, and counts against it', () => {
      const { container } = render(FormTextarea, {
        props: { ...base, label: 'About you', maxlength: 200, value: 'hello' }
      });

      expect(screen.getByLabelText('About you')).toHaveAttribute('maxlength', '200');
      expect(container.querySelector('.weeb-form-count')).toHaveTextContent('5/200');
    });

    it('is not announced -- a live count would read out on every letter typed', () => {
      const { container } = render(FormTextarea, {
        props: { ...base, label: 'About you', maxlength: 200 }
      });

      expect(container.querySelector('.weeb-form-count')).toHaveAttribute('aria-hidden', 'true');
    });

    it('is meaningless without a cap, so it is not drawn', () => {
      const { container } = render(FormTextarea, { props: { ...base, label: 'About you' } });

      expect(container.querySelector('.weeb-form-count')).toBeNull();
    });
  });

  describe('the error state', () => {
    it('shows the message and describes the field with it', () => {
      render(FormTextarea, {
        props: { ...base, label: 'About you', error: 'That is too long' }
      });

      const field = screen.getByLabelText('About you');
      expect(screen.getByText('That is too long')).toHaveAttribute('id', 'bio-error');
      expect(field).toHaveAttribute('aria-describedby', 'bio-error');
      expect(field).toHaveAccessibleDescription('That is too long');
    });

    it('flags the field with the shared has-error class', () => {
      render(FormTextarea, { props: { ...base, label: 'About you', error: 'Required' } });

      expect(screen.getByLabelText('About you')).toHaveClass('weeb-form-textarea', 'has-error');
    });

    it('carries neither without an error', () => {
      render(FormTextarea, { props: { ...base, label: 'About you' } });

      const field = screen.getByLabelText('About you');
      expect(field).not.toHaveClass('has-error');
      expect(field).not.toHaveAttribute('aria-describedby');
    });
  });
});
