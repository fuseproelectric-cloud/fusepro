/**
 * Unit tests for health.monitor.ts
 *
 * Tests alert/logging behaviour on state transitions without running
 * real timers or touching real infrastructure.
 *
 * Strategy: use _processReport() — the internal function that performs
 * transition detection — so tests are fast and deterministic.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { HealthReport } from "../../server/core/health/health.types";

// ─── Mock logger ──────────────────────────────────────────────────────────────

const loggerMock = vi.hoisted(() => ({
  info:  vi.fn(),
  warn:  vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("../../server/core/utils/logger", () => ({ logger: loggerMock }));

// ─── Mock healthService (not used by _processReport, but imported by monitor) ─

const healthServiceMock = vi.hoisted(() => ({
  checkAll: vi.fn(),
}));

vi.mock("../../server/core/health/health.service", () => ({
  healthService: healthServiceMock,
}));

// ─── Subject ──────────────────────────────────────────────────────────────────

import {
  _processReport,
  startHealthMonitor,
  stopHealthMonitor,
  getLastReport,
} from "../../server/core/health/health.monitor";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeReport(
  dbStatus: "ok" | "degraded" | "error",
  queueStatus: "ok" | "degraded" = "ok",
): HealthReport {
  return {
    status:    dbStatus === "error" ? "error" : queueStatus === "degraded" ? "degraded" : "ok",
    checkedAt: new Date().toISOString(),
    checks: {
      db: {
        status:    dbStatus,
        message:   dbStatus === "ok" ? "Database reachable" : "connection refused",
        latencyMs: 5,
        checkedAt: new Date().toISOString(),
      },
      redis: {
        status:    "not_configured",
        message:   "Redis is not configured",
        checkedAt: new Date().toISOString(),
      },
      queue: {
        status:    queueStatus,
        message:   queueStatus === "ok" ? "2 handlers registered" : "no handlers",
        checkedAt: new Date().toISOString(),
      },
    },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("health monitor: first-run behaviour", () => {
  beforeEach(() => {
    stopHealthMonitor();
    loggerMock.info.mockClear();
    loggerMock.warn.mockClear();
    delete process.env.ALERT_ON_HEALTH_TRANSITIONS;
  });

  it("does NOT log when everything is healthy on first run", () => {
    _processReport(makeReport("ok"), true);
    expect(loggerMock.warn).not.toHaveBeenCalled();
    expect(loggerMock.info).not.toHaveBeenCalled();
  });

  it("logs WARN when DB is unhealthy on first run", () => {
    _processReport(makeReport("error"), true);
    expect(loggerMock.warn).toHaveBeenCalledOnce();
    const [msg, ctx] = loggerMock.warn.mock.calls[0];
    expect(msg).toContain("unhealthy at startup");
    expect(ctx).toMatchObject({ dependency: "db", status: "error" });
  });

  it("does NOT alert on redis not_configured even on first run", () => {
    _processReport(makeReport("error"), true);
    const calls = loggerMock.warn.mock.calls;
    expect(calls.every(([, ctx]) => ctx?.dependency !== "redis")).toBe(true);
  });
});

describe("health monitor: state transitions", () => {
  beforeEach(() => {
    stopHealthMonitor();
    loggerMock.info.mockClear();
    loggerMock.warn.mockClear();
    delete process.env.ALERT_ON_HEALTH_TRANSITIONS;
  });

  it("logs WARN when DB transitions ok → error", () => {
    _processReport(makeReport("ok"),    true);  // establishes baseline
    _processReport(makeReport("error"), false);

    expect(loggerMock.warn).toHaveBeenCalledOnce();
    const [msg, ctx] = loggerMock.warn.mock.calls[0];
    expect(msg).toContain("health changed");
    expect(ctx).toMatchObject({ dependency: "db", previousStatus: "ok", status: "error" });
  });

  it("logs INFO when DB recovers error → ok", () => {
    _processReport(makeReport("error"), true);   // unhealthy start
    loggerMock.warn.mockClear();
    _processReport(makeReport("ok"),    false);  // recovery

    expect(loggerMock.info).toHaveBeenCalledOnce();
    const [msg, ctx] = loggerMock.info.mock.calls[0];
    expect(msg).toContain("recovered");
    expect(ctx).toMatchObject({ dependency: "db", previousStatus: "error", status: "ok" });
  });

  it("does NOT log when status is stable between cycles", () => {
    _processReport(makeReport("ok"), true);
    loggerMock.info.mockClear();
    loggerMock.warn.mockClear();

    _processReport(makeReport("ok"), false);
    _processReport(makeReport("ok"), false);

    expect(loggerMock.warn).not.toHaveBeenCalled();
    expect(loggerMock.info).not.toHaveBeenCalled();
  });

  it("logs WARN when queue transitions ok → degraded", () => {
    _processReport(makeReport("ok", "ok"),       true);
    _processReport(makeReport("ok", "degraded"), false);

    expect(loggerMock.warn).toHaveBeenCalledOnce();
    const [, ctx] = loggerMock.warn.mock.calls[0];
    expect(ctx).toMatchObject({ dependency: "queue", status: "degraded" });
  });
});

describe("health monitor: alerting disabled via env var", () => {
  beforeEach(() => {
    stopHealthMonitor();
    loggerMock.warn.mockClear();
    loggerMock.info.mockClear();
    process.env.ALERT_ON_HEALTH_TRANSITIONS = "false";
  });

  afterEach(() => {
    delete process.env.ALERT_ON_HEALTH_TRANSITIONS;
  });

  it("suppresses all transition logs when ALERT_ON_HEALTH_TRANSITIONS=false", () => {
    _processReport(makeReport("ok"),    true);
    _processReport(makeReport("error"), false);
    _processReport(makeReport("ok"),    false);

    expect(loggerMock.warn).not.toHaveBeenCalled();
    expect(loggerMock.info).not.toHaveBeenCalled();
  });
});

describe("health monitor: getLastReport", () => {
  beforeEach(() => stopHealthMonitor());

  it("returns null before any report has been processed", () => {
    expect(getLastReport()).toBeNull();
  });

  it("returns the most recent report after processReport is called", () => {
    const report = makeReport("ok");
    _processReport(report, true);
    expect(getLastReport()).toStrictEqual(report);
  });

  it("updates on each subsequent call", () => {
    _processReport(makeReport("ok"),    true);
    const second = makeReport("error");
    _processReport(second, false);
    expect(getLastReport()).toStrictEqual(second);
  });
});

describe("health monitor: startHealthMonitor / stopHealthMonitor", () => {
  beforeEach(() => {
    stopHealthMonitor();
    loggerMock.info.mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    stopHealthMonitor();
    vi.useRealTimers();
  });

  it("logs startup message when monitor starts", () => {
    healthServiceMock.checkAll.mockResolvedValue(makeReport("ok"));
    startHealthMonitor();
    expect(loggerMock.info).toHaveBeenCalledWith(
      "Health monitor started",
      expect.objectContaining({ source: "health-monitor" }),
    );
  });

  it("calling startHealthMonitor twice is a no-op (idempotent)", () => {
    healthServiceMock.checkAll.mockResolvedValue(makeReport("ok"));
    startHealthMonitor();
    startHealthMonitor();
    // Only one "started" log
    const startedLogs = loggerMock.info.mock.calls.filter(([msg]) =>
      msg === "Health monitor started"
    );
    expect(startedLogs).toHaveLength(1);
  });

  it("stopHealthMonitor resets state so next start is treated as first run", () => {
    healthServiceMock.checkAll.mockResolvedValue(makeReport("ok"));
    startHealthMonitor();
    stopHealthMonitor();
    expect(getLastReport()).toBeNull();
  });
});
