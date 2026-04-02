/**
 * Lightweight in-process domain event bus.
 *
 * Designed for decoupling domain actions (job transitions, timesheet entries)
 * from side effects (notifications, realtime emits). All handlers run in the
 * same Node.js event loop tick — no external infra required.
 *
 * Usage:
 *   // Register a handler (typically at module level in a handler file):
 *   domainEventBus.on(MY_EVENT, async (event) => { ... });
 *
 *   // Publish an event (from a service or route after a domain action):
 *   await domainEventBus.emit(MY_EVENT, payload);
 *
 * Error isolation: errors thrown by one handler propagate to the caller.
 * Handlers are awaited sequentially so later handlers still run if the first
 * one throws (they are not short-circuited by Promise.all failure).
 *
 * The exported singleton `domainEventBus` is used in production.
 * The exported class `DomainEventBus` can be instantiated directly in tests
 * for full isolation without touching the singleton.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler<T = any> = (event: T) => void | Promise<void>;

export class DomainEventBus {
  private readonly handlers = new Map<string, Handler[]>();

  /** Register a handler for the given event name. */
  on<T>(eventName: string, handler: Handler<T>): void {
    const existing = this.handlers.get(eventName) ?? [];
    this.handlers.set(eventName, [...existing, handler]);
  }

  /**
   * Emit an event — awaits each registered handler in registration order.
   * Returns after all handlers have resolved.
   */
  async emit<T>(eventName: string, event: T): Promise<void> {
    const registered = this.handlers.get(eventName) ?? [];
    for (const handler of registered) {
      await handler(event);
    }
  }
}

/** Application-wide singleton. Handlers self-register on import. */
export const domainEventBus = new DomainEventBus();
