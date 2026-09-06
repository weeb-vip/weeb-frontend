import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { createRawSnippet } from 'svelte';
import Button from './Button.svelte';

/**
 * The reference component test for this codebase: a real Svelte 5 component,
 * mounted into jsdom by @testing-library/svelte, driven through the accessible
 * role and name rather than through class names or test ids.
 *
 * Deliberately small. Anything that is a pure decision -- which classes a
 * size/colour pair produces, which phase a status maps to -- belongs in
 * `Button.logic.ts` and is tested as a function, not through the DOM.
 */

/** Children arrive as a snippet in Svelte 5, so a test has to build one. */
const label = (text: string) =>
  createRawSnippet(() => ({ render: () => `<span>${text}</span>` }));

describe('Button', () => {
  it('renders its children as the accessible name', () => {
    render(Button, { props: { children: label('Add to list') } });

    expect(screen.getByRole('button', { name: 'Add to list' })).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    render(Button, { props: { children: label('Save'), onClick } });

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is inert when disabled', async () => {
    const onClick = vi.fn();
    render(Button, { props: { children: label('Save'), onClick, disabled: true } });

    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toBeDisabled();

    await userEvent.click(button);

    expect(onClick).not.toHaveBeenCalled();
  });
});
