/**
 * Unit tests for the background job queue.
 *
 * Tests cover:
 *   - JobQueue class: handler registration, dispatch, error handling, enqueue scheduling
 *   - Notification job handlers: NOTIFY_TIMESHEET_ACTIVITY, NOTIFY_JOB_ACTIVITY
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock notificationService for notification handler tests ──────────────────

const notifMock = vi.hoisted(() => ({
  notifyDayActivity: vi.fn().mockResolvedValue(undefined),
  notifyJobActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../server/services/notification.service", () => ({
  notificationService: notifMock,
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import { JobQueue, jobQueue } from "../../server/core/queue/job-queue";
import {
  NOTIFY_TIMESHEET_ACTIVITY,
  NOTIFY_JOB_ACTIVITY,
  type NotifyTimesheetActivityPayload,
  type NotifyJobActivityPayload,
} from "../../server/core/queue/job-types";

// Import to self-register notification handlers on the jobQueue singleton
import "../../server/core/queue/handlers/notification.handler";

// ─── JobQueue class ───────────────────────────────────────────────────────────

describe("JobQueue", () => {

  it("_dispatch invokes the registered handler with the payload", async () => {
    const queue = new JobQueue();
    const handler = vi.fn().mockResolvedValue(undefined);
    queue.register("test.job", handler);
    await queue._dispatch("test.job", { x: 42 });
    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({ x: 42 });
  });

  it("_dispatch logs an error when no handler is registered", async () => {
    const queue = new JobQueue();
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await queue._dispatch("unknown.job", {});
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0]).toContain("unknown.job");
    spy.mockRestore();
  });

  it("_dispatch catches handler errors and logs them without rethrowing", async () => {
    const queue = new JobQueue();
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    queue.register("fail.job", async () => { throw new Error("boom"); });
    await expect(queue._dispatch("fail.job", {})).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0]).toContain("fail.job");
    expect(spy.mock.calls[0][0]).toContain("boom");
    spy.mockRestore();
  });

  it("enqueue schedules _dispatch via setImmediate", async () => {
    vi.useFakeTimers();
    const queue = new JobQueue();
    const dispatchSpy = vi.spyOn(queue, "_dispatch");
    queue.register("sched.job", vi.fn().mockResolvedValue(undefined));

    queue.enqueue("sched.job", { v: 1 });
    expect(dispatchSpy).not.toHaveBeenCalled(); // not yet — still in current tick

    vi.runAllTimers();
    await Promise.resolve(); // flush microtask
    // enqueue now passes a generated job_id as the third arg for log correlation
    expect(dispatchSpy).toHaveBeenCalledWith("sched.job", { v: 1 }, expect.any(String));

    vi.useRealTimers();
  });

  it("processes multiple independent job types without interference", async () => {
    const queue = new JobQueue();
    const h1 = vi.fn().mockResolvedValue(undefined);
    const h2 = vi.fn().mockResolvedValue(undefined);
    queue.register("job.a", h1);
    queue.register("job.b", h2);
    await queue._dispatch("job.a", "payload-a");
    await queue._dispatch("job.b", "payload-b");
    expect(h1).toHaveBeenCalledWith("payload-a");
    expect(h2).toHaveBeenCalledWith("payload-b");
  });
});

// ─── NOTIFY_TIMESHEET_ACTIVITY handler ───────────────────────────────────────

describe("NOTIFY_TIMESHEET_ACTIVITY job handler", () => {
  beforeEach(() => notifMock.notifyDayActivity.mockReset());

  it("calls notifyDayActivity with the full payload", async () => {
    const ts = new Date("2025-06-01T09:00:00Z");
    const payload: NotifyTimesheetActivityPayload = {
      entryType: "day_start",
      user:      { id: 5, name: "Alex T." },
      timestamp: ts,
      notes:     "Morning shift",
      io:        undefined,
    };
    await jobQueue._dispatch(NOTIFY_TIMESHEET_ACTIVITY, payload);
    expect(notifMock.notifyDayActivity).toHaveBeenCalledOnce();
    expect(notifMock.notifyDayActivity).toHaveBeenCalledWith(payload);
  });

  it("calls notifyDayActivity even when notes is null", async () => {
    const payload: NotifyTimesheetActivityPayload = {
      entryType: "break_end",
      user:      { id: 5, name: "Alex T." },
      timestamp: new Date(),
      notes:     null,
    };
    await jobQueue._dispatch(NOTIFY_TIMESHEET_ACTIVITY, payload);
    expect(notifMock.notifyDayActivity).toHaveBeenCalledWith(
      expect.objectContaining({ notes: null }),
    );
  });
});

// ─── NOTIFY_JOB_ACTIVITY handler ─────────────────────────────────────────────

describe("NOTIFY_JOB_ACTIVITY job handler", () => {
  beforeEach(() => notifMock.notifyJobActivity.mockReset());

  it("calls notifyJobActivity with the full payload", async () => {
    const payload: NotifyJobActivityPayload = {
      entryType:        "travel_start",
      jobId:            10,
      jobTitle:         "HVAC Job",
      technicianName:   "Bob Smith",
      technicianUserId: 3,
      io:               undefined,
    };
    await jobQueue._dispatch(NOTIFY_JOB_ACTIVITY, payload);
    expect(notifMock.notifyJobActivity).toHaveBeenCalledOnce();
    expect(notifMock.notifyJobActivity).toHaveBeenCalledWith(payload);
  });

  it("calls notifyJobActivity when jobTitle is null", async () => {
    const payload: NotifyJobActivityPayload = {
      entryType:        "work_end",
      jobId:            7,
      jobTitle:         null,
      technicianName:   "Eve",
      technicianUserId: 9,
    };
    await jobQueue._dispatch(NOTIFY_JOB_ACTIVITY, payload);
    expect(notifMock.notifyJobActivity).toHaveBeenCalledWith(
      expect.objectContaining({ jobTitle: null }),
    );
  });

  it("failure is caught and logged — does not propagate", async () => {
    notifMock.notifyJobActivity.mockRejectedValueOnce(new Error("DB down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const payload: NotifyJobActivityPayload = {
      entryType:        "work_start",
      jobId:            1,
      jobTitle:         "Job",
      technicianName:   "Sam",
      technicianUserId: 2,
    };
    await expect(jobQueue._dispatch(NOTIFY_JOB_ACTIVITY, payload)).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0]).toContain(NOTIFY_JOB_ACTIVITY);
    spy.mockRestore();
  });
});
