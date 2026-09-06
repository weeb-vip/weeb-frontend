/**
 * The `clickOutside` *action* — the listener lifecycle wrapped around the
 * `isOutside` rule that `clickOutside.test.ts` already covers in isolation.
 * What matters here is the half a pure function cannot show: that the listener
 * goes on in the capture phase, that switching options swaps it rather than
 * stacking it, and above all that `destroy()` takes it off again. The action
 * exists because three components each hand-rolled this and leaked a handler.
 *
 * jsdom is a fair environment for it: event dispatch, capture-phase ordering
 * and `contains()` are all real here. Nothing is stubbed.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clickOutside, type ClickOutsideOptions } from '$lib/actions/clickOutside';

function mount(html: string): HTMLElement {
  document.body.innerHTML = html;
  return document.body.firstElementChild as HTMLElement;
}

afterEach(() => {
  document.body.innerHTML = '';
});

function setup(options: Partial<ClickOutsideOptions> = {}) {
  const node = mount('<div id="menu"><button id="item">Item</button></div>');
  const outside = document.createElement('div');
  outside.id = 'elsewhere';
  document.body.appendChild(outside);

  const handler = vi.fn();
  const action = clickOutside(node, { handler, ...options });
  return { node, outside, handler, action };
}

describe('clickOutside action', () => {
  it('fires the handler for a click outside the node', () => {
    const { outside, handler, action } = setup();
    outside.click();
    expect(handler).toHaveBeenCalledTimes(1);
    action.destroy?.();
  });

  it('stays quiet for a click inside the node', () => {
    const { node, handler, action } = setup();
    (node.querySelector('#item') as HTMLElement).click();
    expect(handler).not.toHaveBeenCalled();
    action.destroy?.();
  });

  it('exempts an ignored element resolved fresh on every event', () => {
    let ignored: Element | null = null;
    const { handler, action } = setup({ ignore: () => ignored });

    // Appended after setup, which resets the body.
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);

    trigger.click();
    expect(handler).toHaveBeenCalledTimes(1);

    ignored = trigger;
    trigger.click();
    expect(handler).toHaveBeenCalledTimes(1);

    action.destroy?.();
  });

  it('listens in the capture phase, so a stopPropagation below cannot strand it', () => {
    const { outside, handler, action } = setup();
    outside.addEventListener('click', (event) => event.stopPropagation());

    outside.click();

    expect(handler).toHaveBeenCalledTimes(1);
    action.destroy?.();
  });

  it('honours the configured event instead of click', () => {
    const { outside, handler, action } = setup({ event: 'mousedown' });

    outside.click();
    expect(handler).not.toHaveBeenCalled();

    outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(handler).toHaveBeenCalledTimes(1);

    action.destroy?.();
  });

  it('attaches nothing while disabled, and attaches on update when enabled', () => {
    const { node, outside, handler, action } = setup({ enabled: false });

    outside.click();
    expect(handler).not.toHaveBeenCalled();

    action.update?.({ handler, enabled: true });
    outside.click();
    expect(handler).toHaveBeenCalledTimes(1);

    action.destroy?.();
    expect(node).toBeDefined();
  });

  it('swaps the listener rather than stacking one per update', () => {
    const { outside, handler, action } = setup({ event: 'click' });

    action.update?.({ handler, event: 'mousedown' });
    outside.click();
    expect(handler).not.toHaveBeenCalled();

    outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(handler).toHaveBeenCalledTimes(1);

    // Re-updating with the same event must not double-register.
    action.update?.({ handler, event: 'mousedown' });
    outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(handler).toHaveBeenCalledTimes(2);

    action.destroy?.();
  });

  it('detaches when an update disables it', () => {
    const { outside, handler, action } = setup();

    action.update?.({ handler, enabled: false });
    outside.click();

    expect(handler).not.toHaveBeenCalled();
    action.destroy?.();
  });

  it('ignores an event that arrives while the options say disabled', () => {
    // The belt-and-braces guard inside the handler: a call site that mutates
    // the options object in place (rather than letting Svelte call `update`)
    // leaves the listener attached with `enabled: false`.
    const node = mount('<div id="menu"></div>');
    const outside = document.createElement('div');
    document.body.appendChild(outside);

    const handler = vi.fn();
    const options: ClickOutsideOptions = { handler, enabled: true };
    const action = clickOutside(node, options);

    options.enabled = false;
    outside.click();

    expect(handler).not.toHaveBeenCalled();
    action.destroy?.();
  });

  it('removes its listener on destroy — the leak the action was written to fix', () => {
    const remove = vi.spyOn(document, 'removeEventListener');
    const { outside, handler, action } = setup();

    try {
      action.destroy?.();
      expect(remove).toHaveBeenCalledWith('click', expect.any(Function), true);

      outside.click();
      expect(handler).not.toHaveBeenCalled();

      // Destroying twice must not throw or remove anything else.
      expect(() => action.destroy?.()).not.toThrow();
      expect(remove).toHaveBeenCalledTimes(1);
    } finally {
      remove.mockRestore();
    }
  });
});
