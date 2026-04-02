/**
 * Unit tests for the domain event layer.
 *
 * Tests cover:
 *   - DomainEventBus: handler registration and dispatch
 *   - handleTimesheetEntryCreated: delegates to notificationService.notifyDayActivity()
 *   - handleJobStatusChanged: socket emits + conditional notifyJobActivity()
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock notificationService before importing handlers ───────────────────────

const notifMock = vi.hoisted(() => ({
  notifyDayActivity:  vi.fn(),
  notifyJobActivity:  vi.fn(),
  notifyJobNote:      vi.fn(),
}));

vi.mock("../../server/services/notification.service", () => ({
  notificationService: notifMock,
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import { DomainEventBus } from "../../server/core/events/domain-event-bus";
import { TIMESHEET_ENTRY_CREATED } from "../../server/core/events/timesheet.events";
import { JOB_STATUS_CHANGED }        from "../../server/core/events/job.events";
import { handleTimesheetEntryCreated } from "../../server/core/events/handlers/timesheet-notification.handler";
import { handleJobStatusChanged }      from "../../server/core/events/handlers/job-notification.handler";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const sampleJob: any = {
  id: 10, title: "HVAC Job", status: "in_progress",
  customerId: 1, technicianId: 2, jobNumber: "J-0001",
};

const sampleUser = { id: 5, name: "Alex T." };

// ─── DomainEventBus ───────────────────────────────────────────────────────────

describe("DomainEventBus", () => {

  it("invokes a registered handler when the event is emitted", async () => {
    const bus = new DomainEventBus();
    const handler = vi.fn();
    bus.on("test.event", handler);
    await bus.emit("test.event", { data: 42 });
    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({ data: 42 });
  });

  it("invokes multiple handlers for the same event in registration order", async () => {
    const bus = new DomainEventBus();
    const order: number[] = [];
    bus.on("seq.event", () => { order.push(1); });
    bus.on("seq.event", () => { order.push(2); });
    await bus.emit("seq.event", null);
    expect(order).toEqual([1, 2]);
  });

  it("does not invoke handlers registered for a different event", async () => {
    const bus = new DomainEventBus();
    const handler = vi.fn();
    bus.on("other.event", handler);
    await bus.emit("test.event", {});
    expect(handler).not.toHaveBeenCalled();
  });

  it("resolves without error when no handlers are registered", async () => {
    const bus = new DomainEventBus();
    await expect(bus.emit("no.handlers", {})).resolves.toBeUndefined();
  });

  it("awaits async handlers before resolving", async () => {
    const bus = new DomainEventBus();
    let resolved = false;
    bus.on("async.event", async () => {
      await new Promise(r => setTimeout(r, 1));
      resolved = true;
    });
    await bus.emit("async.event", null);
    expect(resolved).toBe(true);
  });

  it("uses event name as a discriminator (correct typing via generics)", async () => {
    const bus = new DomainEventBus();
    bus.on<{ x: number }>(TIMESHEET_ENTRY_CREATED, (e) => {
      expect(typeof e.x).toBe("number");
    });
    await bus.emit(TIMESHEET_ENTRY_CREATED, { x: 7 });
  });
});

// ─── handleTimesheetEntryCreated ──────────────────────────────────────────────

describe("handleTimesheetEntryCreated", () => {
  beforeEach(() => notifMock.notifyDayActivity.mockReset());

  it("calls notifyDayActivity with all event fields", async () => {
    const ts = new Date("2025-06-01T08:00:00Z");
    await handleTimesheetEntryCreated({
      entryType: "day_start",
      user:      sampleUser,
      timestamp: ts,
      notes:     "Morning shift",
      io:        undefined,
    });
    expect(notifMock.notifyDayActivity).toHaveBeenCalledOnce();
    expect(notifMock.notifyDayActivity).toHaveBeenCalledWith({
      entryType: "day_start",
      user:      sampleUser,
      timestamp: ts,
      notes:     "Morning shift",
      io:        undefined,
    });
  });

  it("coerces null notes correctly", async () => {
    await handleTimesheetEntryCreated({
      entryType: "break_start",
      user:      sampleUser,
      timestamp: new Date(),
    });
    expect(notifMock.notifyDayActivity).toHaveBeenCalledWith(
      expect.objectContaining({ notes: null }),
    );
  });

  it("forwards the io instance to notifyDayActivity", async () => {
    const io: any = { to: vi.fn().mockReturnThis(), emit: vi.fn() };
    await handleTimesheetEntryCreated({
      entryType: "day_end",
      user:      sampleUser,
      timestamp: new Date(),
      io,
    });
    expect(notifMock.notifyDayActivity).toHaveBeenCalledWith(
      expect.objectContaining({ io }),
    );
  });
});

// ─── handleJobStatusChanged ───────────────────────────────────────────────────

describe("handleJobStatusChanged", () => {
  beforeEach(() => notifMock.notifyJobActivity.mockReset());

  it("emits job:updated to staff:notifications and job:{id} rooms", async () => {
    const io: any = { to: vi.fn().mockReturnThis(), emit: vi.fn() };
    await handleJobStatusChanged({ job: sampleJob, io });
    expect(io.to).toHaveBeenCalledWith("staff:notifications");
    expect(io.to).toHaveBeenCalledWith("job:10");
    expect(io.emit).toHaveBeenCalledWith("job:updated", sampleJob);
  });

  it("does not emit when io is absent", async () => {
    // Should not throw and notifyJobActivity not called either
    await expect(handleJobStatusChanged({ job: sampleJob })).resolves.toBeUndefined();
    expect(notifMock.notifyJobActivity).not.toHaveBeenCalled();
  });

  it("calls notifyJobActivity when notificationEntryType is present", async () => {
    await handleJobStatusChanged({
      job:                   sampleJob,
      notificationEntryType: "travel_start",
      technicianName:        "Bob Smith",
      technicianUserId:      3,
    });
    expect(notifMock.notifyJobActivity).toHaveBeenCalledOnce();
    expect(notifMock.notifyJobActivity).toHaveBeenCalledWith({
      entryType:        "travel_start",
      jobId:            10,
      jobTitle:         "HVAC Job",
      technicianName:   "Bob Smith",
      technicianUserId: 3,
      io:               undefined,
    });
  });

  it("does NOT call notifyJobActivity for admin overrides (no notificationEntryType)", async () => {
    await handleJobStatusChanged({ job: sampleJob, io: undefined });
    expect(notifMock.notifyJobActivity).not.toHaveBeenCalled();
  });

  it("does NOT call notifyJobActivity when technicianName is missing", async () => {
    await handleJobStatusChanged({
      job:                   sampleJob,
      notificationEntryType: "work_start",
      // technicianName intentionally omitted
      technicianUserId:      3,
    });
    expect(notifMock.notifyJobActivity).not.toHaveBeenCalled();
  });

  it("handles null job title gracefully", async () => {
    const jobNoTitle = { ...sampleJob, title: null };
    await handleJobStatusChanged({
      job:                   jobNoTitle,
      notificationEntryType: "work_end",
      technicianName:        "Eve",
      technicianUserId:      7,
    });
    expect(notifMock.notifyJobActivity).toHaveBeenCalledWith(
      expect.objectContaining({ jobTitle: null }),
    );
  });
});
