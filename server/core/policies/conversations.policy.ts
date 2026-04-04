/**
 * Conversation authorization policies — single source of truth for who may
 * perform which conversation management actions.
 *
 * All functions are pure (no I/O) so they are trivially unit-testable.
 */

import type { User } from "@shared/schema";

/** Returns true if the user may rename a conversation. */
export function canRenameConversation(user: User): boolean {
  return user.role === "admin" || user.role === "dispatcher";
}

/** Returns true if the user may add or remove conversation members. */
export function canManageConversationMembers(user: User): boolean {
  return user.role === "admin" || user.role === "dispatcher";
}

/**
 * Returns true if the user may create a conversation of the given type.
 * Technicians may only create direct (1:1) conversations.
 * Group, team, and job conversations require admin or dispatcher.
 */
export function canCreateConversationType(user: User, type: string): boolean {
  if (type === "direct") return true;
  return user.role === "admin" || user.role === "dispatcher";
}
