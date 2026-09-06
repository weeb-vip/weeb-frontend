import { describe, it, expect, vi } from 'vitest';
import { ResendBloc, type TimerPort } from './auth-resend.svelte';

/**
 * The idle/sending/sent/failed machine and its cooldown clock, which five
 * screens used to implement separately.
 *
 * The clock is driven through the `TimerPort` seam rather than by waiting a
 * real minute: `tick()` below is exactly one second passing.
 */
function fakeTimer() {
  let tick: (() => void) | null = null;
  let everyMs = 0;
  let started = 0;
  let stopped = 0;

  const port: TimerPort = {
    start(fn, ms) {
      tick = fn;
      everyMs = ms;
      started += 1;
      return { handle: started };
    },
    stop() {
      stopped += 1;
      tick = null;
    }
  };

  return {
    port,
    get everyMs() {
      return everyMs;
    },
    get started() {
      return started;
    },
    get stopped() {
      return stopped;
    },
    get running() {
      return tick !== null;
    },
    advance(seconds: number) {
      for (let i = 0; i < seconds; i++) tick?.();
    }
  };
}

/** A send port that never settles, for observing the in-flight state. */
function pendingSend() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const settled = new Promise<void>((res, rej) => {
    resolve = () => res();
    reject = rej;
  });

  return {
    send: vi.fn(() => settled),
    resolve,
    reject,
    settled
  };
}

describe('ResendBloc', () => {
  describe('the state machine', () => {
    it('starts idle, sendable, with no error and no cooldown', () => {
      const bloc = new ResendBloc({ send: vi.fn() });

      expect(bloc.state).toBe('idle');
      expect(bloc.isSending).toBe(false);
      expect(bloc.isSent).toBe(false);
      expect(bloc.isFailed).toBe(false);
      expect(bloc.error).toBeNull();
      expect(bloc.canSend).toBe(true);
      expect(bloc.cooldown).toBe(0);
      expect(bloc.isCoolingDown).toBe(false);
    });

    it('is sending while the port has not settled', async () => {
      const port = pendingSend();
      const bloc = new ResendBloc({ send: port.send });

      const inFlight = bloc.resend('someone@example.com');

      expect(bloc.state).toBe('sending');
      expect(bloc.isSending).toBe(true);
      expect(bloc.canSend).toBe(false);

      port.resolve();
      await inFlight;
      expect(bloc.state).toBe('sent');
    });

    it('reports success back to the caller and hands the address to the port', async () => {
      const send = vi.fn(async () => undefined);
      const bloc = new ResendBloc({ send });

      await expect(bloc.resend('someone@example.com')).resolves.toBe(true);
      expect(send).toHaveBeenCalledWith('someone@example.com');
      expect(bloc.isSent).toBe(true);
    });

    it('keeps the rejection for a caller that words its own message', async () => {
      const boom = new Error('User not found');
      const bloc = new ResendBloc({ send: vi.fn(async () => Promise.reject(boom)) });

      await expect(bloc.resend('someone@example.com')).resolves.toBe(false);
      expect(bloc.state).toBe('failed');
      expect(bloc.isFailed).toBe(true);
      expect(bloc.error).toBe(boom);
    });

    it('offers the action again after a failure', async () => {
      const bloc = new ResendBloc({ send: vi.fn(async () => Promise.reject(new Error('nope'))) });

      await bloc.resend('someone@example.com');

      // A failure is exactly when someone wants to try again, so no cooldown.
      expect(bloc.canSend).toBe(true);
    });

    it('clears a previous error when the next attempt starts', async () => {
      const send = vi
        .fn()
        .mockRejectedValueOnce(new Error('nope'))
        .mockResolvedValueOnce(undefined);
      const bloc = new ResendBloc({ send });

      await bloc.resend('someone@example.com');
      expect(bloc.error).not.toBeNull();

      await bloc.resend('someone@example.com');
      expect(bloc.error).toBeNull();
      expect(bloc.state).toBe('sent');
    });
  });

  describe('the sends it refuses', () => {
    it('does nothing without an address', async () => {
      const send = vi.fn();
      const bloc = new ResendBloc({ send });

      await expect(bloc.resend('')).resolves.toBe(false);
      await expect(bloc.resend('   ')).resolves.toBe(false);
      expect(send).not.toHaveBeenCalled();
      // A no-op, not an error: an empty box is not the user's mistake.
      expect(bloc.state).toBe('idle');
    });

    it('does not fan out a second send while one is in flight', async () => {
      const port = pendingSend();
      const bloc = new ResendBloc({ send: port.send });

      const first = bloc.resend('someone@example.com');
      await expect(bloc.resend('someone@example.com')).resolves.toBe(false);

      expect(port.send).toHaveBeenCalledTimes(1);
      port.resolve();
      await first;
    });

    it('does not send again inside the cooldown', async () => {
      const send = vi.fn(async () => undefined);
      const bloc = new ResendBloc({ send, timer: fakeTimer().port, cooldownSeconds: 60 });

      await bloc.resend('someone@example.com');
      await expect(bloc.resend('someone@example.com')).resolves.toBe(false);

      expect(send).toHaveBeenCalledTimes(1);
    });
  });

  describe('the cooldown clock', () => {
    it('does not run at all where the screen asked for no cooldown', async () => {
      const timer = fakeTimer();
      const bloc = new ResendBloc({ send: vi.fn(async () => undefined), timer: timer.port });

      await bloc.resend('someone@example.com');

      expect(timer.started).toBe(0);
      expect(bloc.cooldown).toBe(0);
      expect(bloc.canSend).toBe(true);
    });

    it('starts at the full cooldown and ticks once a second', async () => {
      const timer = fakeTimer();
      const bloc = new ResendBloc({
        send: vi.fn(async () => undefined),
        timer: timer.port,
        cooldownSeconds: 60
      });

      await bloc.resend('someone@example.com');

      expect(bloc.cooldown).toBe(60);
      expect(bloc.cooldownLabel).toBe('1:00');
      expect(timer.everyMs).toBe(1000);

      timer.advance(1);
      expect(bloc.cooldown).toBe(59);
      expect(bloc.cooldownLabel).toBe('0:59');
    });

    it('holds the button inert until the clock reaches zero, then releases it', async () => {
      const timer = fakeTimer();
      const bloc = new ResendBloc({
        send: vi.fn(async () => undefined),
        timer: timer.port,
        cooldownSeconds: 5
      });

      await bloc.resend('someone@example.com');

      timer.advance(4);
      expect(bloc.cooldown).toBe(1);
      expect(bloc.isCoolingDown).toBe(true);
      expect(bloc.canSend).toBe(false);

      timer.advance(1);
      expect(bloc.cooldown).toBe(0);
      expect(bloc.isCoolingDown).toBe(false);
      expect(bloc.canSend).toBe(true);
    });

    it('stops its own interval at zero rather than counting into the negative', async () => {
      const timer = fakeTimer();
      const bloc = new ResendBloc({
        send: vi.fn(async () => undefined),
        timer: timer.port,
        cooldownSeconds: 2
      });

      await bloc.resend('someone@example.com');
      timer.advance(10);

      expect(bloc.cooldown).toBe(0);
      expect(timer.stopped).toBe(1);
      expect(timer.running).toBe(false);
    });

    it('sends again once the clock has run out', async () => {
      const timer = fakeTimer();
      const send = vi.fn(async () => undefined);
      const bloc = new ResendBloc({ send, timer: timer.port, cooldownSeconds: 2 });

      await bloc.resend('someone@example.com');
      timer.advance(2);
      await bloc.resend('someone@example.com');

      expect(send).toHaveBeenCalledTimes(2);
      expect(bloc.cooldown).toBe(2);
    });

    it('restarts one clock rather than stacking two', async () => {
      const timer = fakeTimer();
      const bloc = new ResendBloc({
        send: vi.fn(async () => undefined),
        timer: timer.port,
        cooldownSeconds: 3
      });

      await bloc.resend('someone@example.com');
      timer.advance(3);
      await bloc.resend('someone@example.com');

      // Two starts, and the first was stopped before the second began.
      expect(timer.started).toBe(2);
      timer.advance(1);
      expect(bloc.cooldown).toBe(2);
    });

    it('does not start a clock after a failure', async () => {
      const timer = fakeTimer();
      const bloc = new ResendBloc({
        send: vi.fn(async () => Promise.reject(new Error('nope'))),
        timer: timer.port,
        cooldownSeconds: 60
      });

      await bloc.resend('someone@example.com');

      expect(timer.started).toBe(0);
      expect(bloc.cooldown).toBe(0);
    });

    it('exposes the configured cooldown for a view that renders it', () => {
      expect(new ResendBloc({ send: vi.fn(), cooldownSeconds: 60 }).cooldownSeconds).toBe(60);
      expect(new ResendBloc({ send: vi.fn() }).cooldownSeconds).toBe(0);
    });
  });

  describe('reset and dispose', () => {
    it('reset puts the action back on offer and kills the clock', async () => {
      const timer = fakeTimer();
      const bloc = new ResendBloc({
        send: vi.fn(async () => undefined),
        timer: timer.port,
        cooldownSeconds: 60
      });

      await bloc.resend('someone@example.com');
      bloc.reset();

      expect(bloc.state).toBe('idle');
      expect(bloc.error).toBeNull();
      expect(bloc.cooldown).toBe(0);
      expect(bloc.canSend).toBe(true);
      expect(timer.running).toBe(false);
    });

    it('reset after a failure clears the error too', async () => {
      const bloc = new ResendBloc({ send: vi.fn(async () => Promise.reject(new Error('nope'))) });

      await bloc.resend('someone@example.com');
      bloc.reset();

      expect(bloc.isFailed).toBe(false);
      expect(bloc.error).toBeNull();
    });

    it('reset is safe when no clock was ever started', () => {
      const timer = fakeTimer();
      const bloc = new ResendBloc({ send: vi.fn(), timer: timer.port });

      bloc.reset();

      expect(timer.stopped).toBe(0);
    });

    it('dispose stops the interval that would outlive the view', async () => {
      const timer = fakeTimer();
      const bloc = new ResendBloc({
        send: vi.fn(async () => undefined),
        timer: timer.port,
        cooldownSeconds: 60
      });

      await bloc.resend('someone@example.com');
      bloc.dispose();

      expect(timer.stopped).toBe(1);
      expect(timer.running).toBe(false);
    });

    it('dispose twice stops the clock once', async () => {
      const timer = fakeTimer();
      const bloc = new ResendBloc({
        send: vi.fn(async () => undefined),
        timer: timer.port,
        cooldownSeconds: 60
      });

      await bloc.resend('someone@example.com');
      bloc.dispose();
      bloc.dispose();

      expect(timer.stopped).toBe(1);
    });
  });
});
