import { describe, it, expect } from "vitest";
import {
  canViewAdminTimesheets,
  canApproveTimesheets,
  canEditTimesheetEntry,
  canDeleteTimesheetEntry,
} from "../../server/core/policies/timesheets.policy";
import type { User } from "@shared/schema";

const makeUser = (role: string): User =>
  ({ id: 1, email: "x@x.com", password: "h", name: "X", role, createdAt: new Date() } as User);

const admin      = makeUser("admin");
const dispatcher = makeUser("dispatcher");
const technician = makeUser("technician");

describe("timesheets.policy", () => {

  describe("canViewAdminTimesheets", () => {
    it("allows admin",      () => expect(canViewAdminTimesheets(admin)).toBe(true));
    it("allows dispatcher", () => expect(canViewAdminTimesheets(dispatcher)).toBe(true));
    it("denies technician", () => expect(canViewAdminTimesheets(technician)).toBe(false));
  });

  describe("canApproveTimesheets", () => {
    it("allows admin",      () => expect(canApproveTimesheets(admin)).toBe(true));
    it("allows dispatcher", () => expect(canApproveTimesheets(dispatcher)).toBe(true));
    it("denies technician", () => expect(canApproveTimesheets(technician)).toBe(false));
  });

  describe("canEditTimesheetEntry", () => {
    it("allows admin",      () => expect(canEditTimesheetEntry(admin)).toBe(true));
    it("allows dispatcher", () => expect(canEditTimesheetEntry(dispatcher)).toBe(true));
    it("denies technician", () => expect(canEditTimesheetEntry(technician)).toBe(false));
  });

  describe("canDeleteTimesheetEntry", () => {
    it("allows admin",      () => expect(canDeleteTimesheetEntry(admin)).toBe(true));
    it("allows dispatcher", () => expect(canDeleteTimesheetEntry(dispatcher)).toBe(true));
    it("denies technician", () => expect(canDeleteTimesheetEntry(technician)).toBe(false));
  });

});
