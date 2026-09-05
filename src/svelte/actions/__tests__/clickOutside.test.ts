import { describe, expect, test } from '@jest/globals';
import { isOutside, type MaybeElement } from '../clickOutside';

/**
 * A stand-in for an element tree. `testEnvironment` is node, so there is no
 * DOM — but the rule under test only ever asks `contains()`, so a fake with a
 * real `contains` exercises it exactly.
 */
function element(name: string, children: string[] = []): Element & { name: string } {
  const owned = new Set([name, ...children]);
  return {
    name,
    nodeType: 1,
    contains(node: unknown) {
      return !!node && owned.has((node as { name?: string }).name ?? '');
    }
  } as unknown as Element & { name: string };
}

/** A click target that belongs to nothing. */
const elsewhere = { nodeType: 1, name: 'page-background' };

describe('isOutside', () => {
  const menu = element('menu', ['menu-item']);
  const trigger = element('trigger', ['trigger-icon']);

  test('a click inside the node is not outside', () => {
    expect(isOutside({ nodeType: 1, name: 'menu-item' }, menu)).toBe(false);
  });

  test('a click on the node itself is not outside', () => {
    expect(isOutside({ nodeType: 1, name: 'menu' }, menu)).toBe(false);
  });

  test('a click anywhere else is outside', () => {
    expect(isOutside(elsewhere, menu)).toBe(true);
  });

  test('the trigger is exempt when listed in ignore', () => {
    // Without this the button that opened the surface immediately closes it.
    const target = { nodeType: 1, name: 'trigger-icon' };
    expect(isOutside(target, menu)).toBe(true);
    expect(isOutside(target, menu, trigger)).toBe(false);
  });

  test('accepts an array of ignored elements', () => {
    const other = element('backdrop');
    expect(isOutside({ nodeType: 1, name: 'backdrop' }, menu, [trigger, other])).toBe(false);
    expect(isOutside(elsewhere, menu, [trigger, other])).toBe(true);
  });

  test('resolves a getter fresh, so a portalled menu bound later still counts', () => {
    let portalled: MaybeElement;
    const getIgnored = () => portalled;
    const target = { nodeType: 1, name: 'portalled-item' };

    expect(isOutside(target, trigger, getIgnored)).toBe(true);
    portalled = element('portalled', ['portalled-item']);
    expect(isOutside(target, trigger, getIgnored)).toBe(false);
  });

  test('tolerates unbound elements in the ignore list', () => {
    expect(isOutside(elsewhere, menu, [null, undefined, trigger])).toBe(true);
  });

  test('an unbound node means nothing has rendered yet — never fires', () => {
    expect(isOutside(elsewhere, null)).toBe(false);
    expect(isOutside(elsewhere, undefined, trigger)).toBe(false);
  });

  test('a non-Node target (a window-level event) counts as outside', () => {
    expect(isOutside(null, menu)).toBe(true);
    expect(isOutside({ notANode: true }, menu)).toBe(true);
  });
});
