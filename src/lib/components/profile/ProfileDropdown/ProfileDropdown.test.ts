import { describe, it, expect } from 'vitest';
import { ProfileDropdownBloc } from './ProfileDropdown.bloc.svelte';

describe('ProfileDropdownBloc', () => {
  it('starts closed', () => {
    expect(new ProfileDropdownBloc().isOpen).toBe(false);
  });

  it('can be constructed open, which is what a static story needs', () => {
    expect(new ProfileDropdownBloc(true).isOpen).toBe(true);
  });

  it('toggles both ways', () => {
    const bloc = new ProfileDropdownBloc();

    bloc.toggle();
    expect(bloc.isOpen).toBe(true);

    bloc.toggle();
    expect(bloc.isOpen).toBe(false);
  });

  it('closes, and closing again is a no-op', () => {
    const bloc = new ProfileDropdownBloc(true);

    bloc.close();
    expect(bloc.isOpen).toBe(false);

    bloc.close();
    expect(bloc.isOpen).toBe(false);
  });
});
