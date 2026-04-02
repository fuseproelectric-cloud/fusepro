/**
 * Registers all domain event handlers on the global domainEventBus singleton.
 *
 * Import this module once at application startup (server/routes.ts).
 * Each handler file registers itself via a module-level `domainEventBus.on()`
 * call, so merely importing this file is sufficient.
 */
import "./handlers/timesheet-notification.handler";
import "./handlers/job-notification.handler";
