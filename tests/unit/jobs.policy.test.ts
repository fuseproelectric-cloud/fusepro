import { describe, it, expect } from "vitest";
import {
  canTechnicianTransitionJob,
  canOverrideJobStatus,
} from "../../server/core/policies/jobs.policy";
import type { User } from "@shared/schema";

const makeUser = (role: string): User =>
  ({ id: 1, email: "x@x.com", password: "h", name: "X", role, createdAt: new Date() } as User);

const admin      = makeUser("admin");
const dispatcher = makeUser("dispatcher");
const technician = makeUser("technician");

describe("jobs.policy", () => {

  describe("canTechnicianTransitionJob", () => {
    it("allows technician",  () => expect(canTechnicianTransitionJob(technician)).toBe(true));
    it("denies admin",       () => expect(canTechnicianTransitionJob(admin)).toBe(false));
    it("denies dispatcher",  () => expect(canTechnicianTransitionJob(dispatcher)).toBe(false));
  });

  describe("canOverrideJobStatus", () => {
    it("allows admin",       () => expect(canOverrideJobStatus(admin)).toBe(true));
    it("allows dispatcher",  () => expect(canOverrideJobStatus(dispatcher)).toBe(true));
    it("denies technician",  () => expect(canOverrideJobStatus(technician)).toBe(false));
  });

});
