import { describe, it, expect } from "vitest";
import {
  JOB_STATUSES,
  TECHNICIAN_TRANSITIONS,
  TECHNICIAN_TERMINAL_STATUSES,
  TRANSITION_NOTIFICATION_ENTRY,
  isTechnicianTransitionAllowed,
  isTerminalForTechnician,
  toJobStatus,
} from "../../server/modules/jobs/job-status.lifecycle";

describe("job-status.lifecycle", () => {

  describe("JOB_STATUSES", () => {
    it("includes all expected status values", () => {
      expect(JOB_STATUSES).toContain("pending");
      expect(JOB_STATUSES).toContain("assigned");
      expect(JOB_STATUSES).toContain("on_the_way");
      expect(JOB_STATUSES).toContain("in_progress");
      expect(JOB_STATUSES).toContain("completed");
      expect(JOB_STATUSES).toContain("cancelled");
    });
  });

  describe("TECHNICIAN_TRANSITIONS", () => {
    it("defines the linear technician path", () => {
      expect(TECHNICIAN_TRANSITIONS.get("assigned")).toBe("on_the_way");
      expect(TECHNICIAN_TRANSITIONS.get("on_the_way")).toBe("in_progress");
      expect(TECHNICIAN_TRANSITIONS.get("in_progress")).toBe("completed");
    });

    it("does not allow skipping steps", () => {
      expect(TECHNICIAN_TRANSITIONS.get("assigned")).not.toBe("in_progress");
      expect(TECHNICIAN_TRANSITIONS.get("assigned")).not.toBe("completed");
    });

    it("has no forward transition out of terminal statuses", () => {
      expect(TECHNICIAN_TRANSITIONS.has("completed")).toBe(false);
      expect(TECHNICIAN_TRANSITIONS.has("cancelled")).toBe(false);
    });
  });

  describe("isTechnicianTransitionAllowed", () => {
    it("allows valid forward transitions", () => {
      expect(isTechnicianTransitionAllowed("assigned",    "on_the_way" )).toBe(true);
      expect(isTechnicianTransitionAllowed("on_the_way",  "in_progress")).toBe(true);
      expect(isTechnicianTransitionAllowed("in_progress", "completed"  )).toBe(true);
    });

    it("rejects backward transitions", () => {
      expect(isTechnicianTransitionAllowed("in_progress", "on_the_way")).toBe(false);
      expect(isTechnicianTransitionAllowed("completed",   "in_progress")).toBe(false);
    });

    it("rejects skipping steps", () => {
      expect(isTechnicianTransitionAllowed("assigned",   "in_progress")).toBe(false);
      expect(isTechnicianTransitionAllowed("assigned",   "completed"  )).toBe(false);
      expect(isTechnicianTransitionAllowed("on_the_way", "completed"  )).toBe(false);
    });

    it("rejects self-transitions", () => {
      expect(isTechnicianTransitionAllowed("assigned",    "assigned"   )).toBe(false);
      expect(isTechnicianTransitionAllowed("in_progress", "in_progress")).toBe(false);
    });

    it("rejects transitions from pending (not assignable by technician)", () => {
      expect(isTechnicianTransitionAllowed("pending", "assigned"   )).toBe(false);
      expect(isTechnicianTransitionAllowed("pending", "on_the_way" )).toBe(false);
    });
  });

  describe("isTerminalForTechnician", () => {
    it("marks completed and cancelled as terminal", () => {
      expect(isTerminalForTechnician("completed")).toBe(true);
      expect(isTerminalForTechnician("cancelled")).toBe(true);
    });

    it("does not mark in-progress statuses as terminal", () => {
      expect(isTerminalForTechnician("pending"    )).toBe(false);
      expect(isTerminalForTechnician("assigned"   )).toBe(false);
      expect(isTerminalForTechnician("on_the_way" )).toBe(false);
      expect(isTerminalForTechnician("in_progress")).toBe(false);
    });

    it("TECHNICIAN_TERMINAL_STATUSES and isTerminalForTechnician are consistent", () => {
      for (const s of JOB_STATUSES) {
        expect(isTerminalForTechnician(s)).toBe(TECHNICIAN_TERMINAL_STATUSES.has(s));
      }
    });
  });

  describe("TRANSITION_NOTIFICATION_ENTRY", () => {
    it("maps status transitions to their canonical timesheet entry types", () => {
      expect(TRANSITION_NOTIFICATION_ENTRY["on_the_way" ]).toBe("travel_start");
      expect(TRANSITION_NOTIFICATION_ENTRY["in_progress"]).toBe("work_start");
      expect(TRANSITION_NOTIFICATION_ENTRY["completed"  ]).toBe("work_end");
    });

    it("has no entry for non-transitioning statuses", () => {
      expect(TRANSITION_NOTIFICATION_ENTRY["pending"  ]).toBeUndefined();
      expect(TRANSITION_NOTIFICATION_ENTRY["assigned" ]).toBeUndefined();
      expect(TRANSITION_NOTIFICATION_ENTRY["cancelled"]).toBeUndefined();
    });
  });

  describe("toJobStatus", () => {
    it("returns the status for valid values", () => {
      expect(toJobStatus("pending"    )).toBe("pending");
      expect(toJobStatus("in_progress")).toBe("in_progress");
      expect(toJobStatus("completed"  )).toBe("completed");
    });

    it("returns undefined for unknown values", () => {
      expect(toJobStatus("unknown" )).toBeUndefined();
      expect(toJobStatus(""        )).toBeUndefined();
      expect(toJobStatus("PENDING" )).toBeUndefined();
    });
  });

});
