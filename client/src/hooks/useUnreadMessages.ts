import { useState, useEffect } from "react";
import type { Socket } from "socket.io-client";
import { getSocket } from "@/lib/socket";

export type NotificationType = "message" | "activity";

export interface AppNotification {
  id: string;               // unique key (prefixed for socket events, numeric string for DB)
  dbId?: number;            // DB row id for marking read
  type: NotificationType;
  jobId: number | null;
  jobTitle: string | null;
  fromName: string;
  text: string;
  timestamp: string;
  messageCount?: number;
  entryType?: string;
}

// ─── Module-level state ───────────────────────────────────────────────────────
let _socket: Socket | null = null;
let _socketUserId: number | null = null;

// Keyed by unique id
let _notifications: Record<string, AppNotification> = {};

const NOTIF_EVENT = "unread:update";

function broadcast() {
  window.dispatchEvent(new CustomEvent(NOTIF_EVENT));
}

const ACTIVITY_LABELS: Record<string, string> = {
  day_start:    "started their day",
  day_end:      "ended their day",
  break_start:  "started a break",
  break_end:    "returned from break",
  travel_start: "is on the way",
  travel_end:   "arrived at job site",
  work_start:   "started working",
  work_end:     "completed work",
};

const ACTIVITY_ICONS: Record<string, string> = {
  day_start:    "☀️",
  day_end:      "🏁",
  break_start:  "☕",
  break_end:    "🔄",
  travel_start: "🚗",
  travel_end:   "📍",
  work_start:   "🔧",
  work_end:     "✅",
};

export function getActivityIcon(entryType: string) {
  return ACTIVITY_ICONS[entryType] ?? "•";
}

async function fetchAndLoad(userId: number) {
  try {
    const res = await fetch("/api/notifications");
    if (!res.ok) return;
    const rows: Array<{
      id: number; type: string; jobId: number | null; jobTitle: string | null;
      fromName: string; text: string; timestamp: string;
      messageCount: number | null; entryType: string | null;
    }> = await res.json();

    // Merge DB rows — don't overwrite real-time notifications added in this session
    rows.forEach(row => {
      const key = `db:${row.id}`;
      if (!_notifications[key]) {
        _notifications[key] = {
          id: key,
          dbId: row.id,
          type: row.type as NotificationType,
          jobId: row.jobId,
          jobTitle: row.jobTitle,
          fromName: row.fromName,
          text: row.text,
          timestamp: row.timestamp,
          messageCount: row.messageCount ?? undefined,
          entryType: row.entryType ?? undefined,
        };
      }
    });
    broadcast();
  } catch {
    // ignore
  }
}

export async function markJobRead(jobId: number) {
  // Remove from local state
  Object.keys(_notifications).forEach(k => {
    const n = _notifications[k];
    if (n.type === "message" && n.jobId === jobId) delete _notifications[k];
  });
  broadcast();
  // Persist to DB
  try {
    await fetch(`/api/notifications/read-job/${jobId}`, { method: "PUT" });
  } catch { /* ignore */ }
}

export async function clearActivityNotification(id: string) {
  const notif = _notifications[id];
  if (!notif) return;
  delete _notifications[id];
  broadcast();
  if (notif.dbId) {
    try {
      await fetch(`/api/notifications/${notif.dbId}/read`, { method: "PUT" });
    } catch { /* ignore */ }
  }
}

export function initNotifications(user: { id: number; role: string }) {
  if (_socket && _socketUserId === user.id) return;

  if (_socket) {
    _socket.disconnect();
    _socket = null;
    _notifications = {};
  }

  _socketUserId = user.id;

  // Load persisted notifications from DB
  fetchAndLoad(user.id);

  const socket = getSocket();
  _socket = socket;

  // Chat message notifications
  socket.on("notification:new_message", (data: {
    jobId: number;
    fromUserId: number;
    fromName: string;
    jobTitle: string;
    messagePreview: string;
    timestamp: string;
    technicianUserId: number | null;
  }) => {
    if (data.fromUserId === user.id) return;
    if (user.role === "technician" && data.technicianUserId !== user.id) return;

    // Update or create an in-session entry (DB row will arrive on next fetch)
    const sessionKey = `msg:${data.jobId}`;
    const existing = _notifications[sessionKey];
    _notifications[sessionKey] = {
      id: sessionKey,
      type: "message",
      jobId: data.jobId,
      jobTitle: data.jobTitle || `Job #${data.jobId}`,
      fromName: data.fromName,
      text: data.messagePreview || "New message",
      timestamp: data.timestamp || new Date().toISOString(),
      messageCount: (existing?.messageCount ?? 0) + 1,
    };
    // Remove any DB-loaded duplicate for this job so we show the freshest
    Object.keys(_notifications).forEach(k => {
      if (k !== sessionKey && _notifications[k].type === "message" && _notifications[k].jobId === data.jobId) {
        delete _notifications[k];
      }
    });
    broadcast();
  });

  // Activity notifications (admin/dispatcher only)
  socket.on("notification:activity", (data: {
    entryType: string;
    technicianName: string;
    technicianUserId: number;
    jobId: number | null;
    jobTitle: string | null;
    timestamp: string;
    notes: string | null;
  }) => {
    if (user.role === "technician") return;

    const label = ACTIVITY_LABELS[data.entryType] ?? data.entryType.replace(/_/g, " ");
    const jobPart = data.jobTitle ? ` — ${data.jobTitle}` : "";
    const key = `act:${data.technicianUserId}:${data.entryType}:${data.jobId ?? ""}:${Date.now()}`;

    _notifications[key] = {
      id: key,
      type: "activity",
      jobId: data.jobId,
      jobTitle: data.jobTitle,
      fromName: data.technicianName,
      text: `${label}${jobPart}`,
      timestamp: data.timestamp || new Date().toISOString(),
      entryType: data.entryType,
    };
    broadcast();
  });
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useUnreadMessages(user?: { id: number; role: string } | null) {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const handler = () => forceUpdate(n => n + 1);
    window.addEventListener(NOTIF_EVENT, handler);
    return () => window.removeEventListener(NOTIF_EVENT, handler);
  }, []);

  useEffect(() => {
    if (user) initNotifications(user);
  }, [user?.id, user?.role]);

  const all = Object.values(_notifications);
  const messageNotifs = all.filter(n => n.type === "message");
  const activityNotifs = all.filter(n => n.type === "activity");

  const allNotifications: AppNotification[] = all
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const totalUnread = messageNotifs.reduce((s, n) => s + (n.messageCount ?? 1), 0) + activityNotifs.length;
  const unreadByJob: Record<number, number> = {};
  messageNotifs.forEach(n => { if (n.jobId) unreadByJob[n.jobId] = n.messageCount ?? 1; });

  return { totalUnread, notifications: allNotifications, unreadByJob };
}
