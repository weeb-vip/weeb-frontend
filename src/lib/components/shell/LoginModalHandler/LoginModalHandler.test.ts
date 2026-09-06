import { describe, it, expect, vi } from 'vitest';
import { writable } from 'svelte/store';
import {
  LoginModalHandlerBloc,
  windowAuthPromptEvents,
  type LoginModalPort
} from './LoginModalHandler.bloc.svelte';

/** The auth-modal store, in memory. */
function modalPort(initial = { isOpen: false, register: false }) {
  const store = writable(initial);
  return Object.assign(store, {
    openLogin: vi.fn(() => store.set({ isOpen: true, register: false })),
    openRegister: vi.fn(() => store.set({ isOpen: true, register: true })),
    close: vi.fn(() => store.set({ isOpen: false, register: false }))
  }) as LoginModalPort & {
    openLogin: ReturnType<typeof vi.fn>;
    openRegister: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  };
}

describe('LoginModalHandlerBloc', () => {
  it('reads whether the modal is up from the store', () => {
    expect(new LoginModalHandlerBloc({ modal: modalPort(), events: { listen: () => () => {} } }).isOpen).toBe(
      false
    );

    const open = modalPort({ isOpen: true, register: true });
    expect(
      new LoginModalHandlerBloc({ modal: open, events: { listen: () => () => {} } }).isOpen
    ).toBe(true);
  });

  it('follows the store while it is mounted', () => {
    const modal = modalPort();
    const bloc = new LoginModalHandlerBloc({ modal, events: { listen: () => () => {} } });

    modal.openLogin();

    expect(bloc.isOpen).toBe(true);
  });

  it('forwards a close to the store rather than holding its own flag', () => {
    const modal = modalPort({ isOpen: true, register: false });
    const bloc = new LoginModalHandlerBloc({ modal, events: { listen: () => () => {} } });

    bloc.close();

    expect(modal.close).toHaveBeenCalledTimes(1);
    expect(bloc.isOpen).toBe(false);
  });

  it('opens the right mode for each global prompt', () => {
    const modal = modalPort();
    let handlers!: { openLogin(): void; openRegister(): void };
    const bloc = new LoginModalHandlerBloc({
      modal,
      events: {
        listen: (h) => {
          handlers = h;
          return () => {};
        }
      }
    });

    bloc.listen();
    handlers.openLogin();
    expect(modal.openLogin).toHaveBeenCalledTimes(1);

    handlers.openRegister();
    expect(modal.openRegister).toHaveBeenCalledTimes(1);
  });

  it('hands the listener teardown back, so nothing leaks past the view', () => {
    const stop = vi.fn();
    const bloc = new LoginModalHandlerBloc({ modal: modalPort(), events: { listen: () => stop } });

    bloc.listen()();

    expect(stop).toHaveBeenCalledTimes(1);
  });
});

describe('windowAuthPromptEvents', () => {
  it('answers the two global events anything on the page can fire', () => {
    const handlers = { openLogin: vi.fn(), openRegister: vi.fn() };

    const stop = windowAuthPromptEvents.listen(handlers);
    window.dispatchEvent(new Event('openLogin'));
    window.dispatchEvent(new Event('openRegister'));

    expect(handlers.openLogin).toHaveBeenCalledTimes(1);
    expect(handlers.openRegister).toHaveBeenCalledTimes(1);

    stop();
  });

  it('stops answering once torn down', () => {
    const handlers = { openLogin: vi.fn(), openRegister: vi.fn() };
    const stop = windowAuthPromptEvents.listen(handlers);

    stop();
    window.dispatchEvent(new Event('openLogin'));
    window.dispatchEvent(new Event('openRegister'));

    // Every mount used to leak two listeners.
    expect(handlers.openLogin).not.toHaveBeenCalled();
    expect(handlers.openRegister).not.toHaveBeenCalled();
  });
});
