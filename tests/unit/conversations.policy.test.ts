/**
 * Unit tests for conversation authorization policies.
 *
 * Covers:
 *   - canRenameConversation: admin/dispatcher allowed, technician denied
 *   - canManageConversationMembers: admin/dispatcher allowed, technician denied
 *   - canCreateConversationType: direct allowed for all roles, group/team/job
 *     restricted to admin/dispatcher
 */

import { describe, it, expect } from "vitest";
import type { User } from "@shared/schema";
import {
  canRenameConversation,
  canManageConversationMembers,
  canCreateConversationType,
} from "../../server/core/policies/conversations.policy";

function makeUser(role: "admin" | "dispatcher" | "technician"): User {
  return {
    id: 1,
    name: "Test User",
    email: "test@example.com",
    password: "hashed",
    role,
    createdAt: new Date(),
  } as unknown as User;
}

// ─── canRenameConversation ────────────────────────────────────────────────────

describe("canRenameConversation", () => {
  it("allows admin", () => {
    expect(canRenameConversation(makeUser("admin"))).toBe(true);
  });

  it("allows dispatcher", () => {
    expect(canRenameConversation(makeUser("dispatcher"))).toBe(true);
  });

  it("denies technician", () => {
    expect(canRenameConversation(makeUser("technician"))).toBe(false);
  });
});

// ─── canManageConversationMembers ─────────────────────────────────────────────

describe("canManageConversationMembers", () => {
  it("allows admin", () => {
    expect(canManageConversationMembers(makeUser("admin"))).toBe(true);
  });

  it("allows dispatcher", () => {
    expect(canManageConversationMembers(makeUser("dispatcher"))).toBe(true);
  });

  it("denies technician", () => {
    expect(canManageConversationMembers(makeUser("technician"))).toBe(false);
  });
});

// ─── canCreateConversationType ────────────────────────────────────────────────

describe("canCreateConversationType", () => {
  it("allows direct for admin", () => {
    expect(canCreateConversationType(makeUser("admin"), "direct")).toBe(true);
  });

  it("allows direct for dispatcher", () => {
    expect(canCreateConversationType(makeUser("dispatcher"), "direct")).toBe(true);
  });

  it("allows direct for technician", () => {
    expect(canCreateConversationType(makeUser("technician"), "direct")).toBe(true);
  });

  it("allows group for admin", () => {
    expect(canCreateConversationType(makeUser("admin"), "group")).toBe(true);
  });

  it("allows group for dispatcher", () => {
    expect(canCreateConversationType(makeUser("dispatcher"), "group")).toBe(true);
  });

  it("denies group for technician", () => {
    expect(canCreateConversationType(makeUser("technician"), "group")).toBe(false);
  });

  it("denies team for technician", () => {
    expect(canCreateConversationType(makeUser("technician"), "team")).toBe(false);
  });

  it("denies job for technician", () => {
    expect(canCreateConversationType(makeUser("technician"), "job")).toBe(false);
  });

  it("allows team for admin", () => {
    expect(canCreateConversationType(makeUser("admin"), "team")).toBe(true);
  });

  it("allows job for dispatcher", () => {
    expect(canCreateConversationType(makeUser("dispatcher"), "job")).toBe(true);
  });
});
