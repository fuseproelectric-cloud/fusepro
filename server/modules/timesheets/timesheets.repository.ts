import { eq, desc, and, gte, lt, inArray } from "drizzle-orm";
import { db } from "../../db";
import { dayBoundsCT, weekBoundsCT, dateStrCT } from "../../lib/time";
import { timesheetsDomainService } from "./timesheets.domain-service";
import { techniciansRepository } from "../technicians/technicians.repository";
import {
  timesheets, jobs, users, technicians, timesheetApprovals,
  type Timesheet, type InsertTimesheet,
} from "@shared/schema";

// ─── Local types ──────────────────────────────────────────────────────────────

export type TimesheetWithJob = Timesheet & { jobTitle?: string | null };

export type TechnicianTimesheetGroup = {
  technicianId: number;
  technicianName: string;
  technicianColor: string;
  entries: TimesheetWithJob[];
};

export type ApprovalMap = Record<
  string,
  { approvedBy: number; approvedAt: Date; snapshotRate: string | null }
>;

// ─── Repository ───────────────────────────────────────────────────────────────

export const timesheetsRepository = {

  // ── Single-technician queries ──────────────────────────────────────────────

  async getTodayEntries(technicianId: number): Promise<TimesheetWithJob[]> {
    const { start, end } = dayBoundsCT();
    const rows = await db
      .select({ ts: timesheets, jobTitle: jobs.title })
      .from(timesheets)
      .leftJoin(jobs, eq(timesheets.jobId, jobs.id))
      .where(
        and(
          eq(timesheets.technicianId, technicianId),
          gte(timesheets.timestamp, start),
          lt(timesheets.timestamp, end),
        ),
      )
      .orderBy(timesheets.timestamp);
    return rows.map((r) => ({ ...r.ts, jobTitle: r.jobTitle ?? null }));
  },

  async getWeekEntries(technicianId: number, weekOf?: string): Promise<TimesheetWithJob[]> {
    const { start, end } = weekBoundsCT(weekOf);
    const rows = await db
      .select({ ts: timesheets, jobTitle: jobs.title })
      .from(timesheets)
      .leftJoin(jobs, eq(timesheets.jobId, jobs.id))
      .where(
        and(
          eq(timesheets.technicianId, technicianId),
          gte(timesheets.timestamp, start),
          lt(timesheets.timestamp, end),
        ),
      )
      .orderBy(timesheets.timestamp);
    return rows.map((r) => ({ ...r.ts, jobTitle: r.jobTitle ?? null }));
  },

  /** Derives the technician's live day status from today's entries. */
  async getCurrentStatus(technicianId: number) {
    const todayEntries = await timesheetsRepository.getTodayEntries(technicianId);
    return timesheetsDomainService.computeCurrentStatus(todayEntries);
  },

  async getEntriesByJob(jobId: number): Promise<(Timesheet & { technicianName?: string | null })[]> {
    const rows = await db
      .select({ ts: timesheets, techName: users.name })
      .from(timesheets)
      .leftJoin(technicians, eq(timesheets.technicianId, technicians.id))
      .leftJoin(users, eq(technicians.userId, users.id))
      .where(eq(timesheets.jobId, jobId))
      .orderBy(timesheets.timestamp);
    return rows.map((r) => ({ ...r.ts, technicianName: r.techName ?? null }));
  },

  async getLastEntry(technicianId: number, entryType?: string): Promise<Timesheet | null> {
    const condition = entryType
      ? and(eq(timesheets.technicianId, technicianId), eq(timesheets.entryType, entryType))
      : eq(timesheets.technicianId, technicianId);
    const [entry] = await db
      .select()
      .from(timesheets)
      .where(condition)
      .orderBy(desc(timesheets.timestamp))
      .limit(1);
    return entry ?? null;
  },

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async create(data: InsertTimesheet): Promise<Timesheet> {
    const [entry] = await db.insert(timesheets).values(data).returning();
    return entry;
  },

  async getById(id: number): Promise<Timesheet | null> {
    const [entry] = await db.select().from(timesheets).where(eq(timesheets.id, id));
    return entry ?? null;
  },

  async update(
    id: number,
    data: { entryType?: string; timestamp?: Date; notes?: string | null },
  ): Promise<Timesheet | null> {
    const [entry] = await db.update(timesheets).set(data).where(eq(timesheets.id, id)).returning();
    return entry ?? null;
  },

  async delete(id: number): Promise<void> {
    await db.delete(timesheets).where(eq(timesheets.id, id));
  },

  // ── Approvals ─────────────────────────────────────────────────────────────

  /**
   * Upserts an approval for a technician-date pair.
   * Reads the current hourlyRate and freezes it on the record so future
   * rate changes cannot retroactively alter approved earnings.
   */
  async approveDay(technicianId: number, date: string, approvedBy: number): Promise<void> {
    const [tech] = await db
      .select({ hourlyRate: technicians.hourlyRate })
      .from(technicians)
      .where(eq(technicians.id, technicianId));
    const snapshotRate = tech?.hourlyRate ?? "25.00";

    await db
      .insert(timesheetApprovals)
      .values({ technicianId, date, approvedBy, snapshotRate })
      .onConflictDoUpdate({
        target: [timesheetApprovals.technicianId, timesheetApprovals.date],
        set: { approvedBy, approvedAt: new Date(), snapshotRate },
      });
  },

  async unapproveDay(technicianId: number, date: string): Promise<void> {
    await db
      .delete(timesheetApprovals)
      .where(
        and(
          eq(timesheetApprovals.technicianId, technicianId),
          eq(timesheetApprovals.date, date),
        ),
      );
  },

  async getApprovals(technicianId: number, dates: string[]): Promise<ApprovalMap> {
    if (dates.length === 0) return {};
    const rows = await db
      .select()
      .from(timesheetApprovals)
      .where(
        and(
          eq(timesheetApprovals.technicianId, technicianId),
          inArray(timesheetApprovals.date, dates),
        ),
      );
    const result: ApprovalMap = {};
    for (const r of rows) {
      result[r.date] = { approvedBy: r.approvedBy, approvedAt: r.approvedAt, snapshotRate: r.snapshotRate ?? null };
    }
    return result;
  },

  // ── Admin cross-technician queries ─────────────────────────────────────────

  /**
   * Returns all entries for a given date grouped by technician.
   * Technicians with no entries on that day are included with an empty array
   * so the admin view always shows the full roster.
   */
  async getAllByDate(dateStrOrDate: Date | string): Promise<TechnicianTimesheetGroup[]> {
    const ctStr = typeof dateStrOrDate === "string" ? dateStrOrDate : dateStrCT(dateStrOrDate);
    const { start, end } = dayBoundsCT(ctStr);

    const rows = await db
      .select({
        ts:        timesheets,
        jobTitle:  jobs.title,
        userName:  users.name,
        techColor: technicians.color,
      })
      .from(timesheets)
      .leftJoin(jobs,         eq(timesheets.jobId,        jobs.id))
      .leftJoin(technicians,  eq(timesheets.technicianId, technicians.id))
      .leftJoin(users,        eq(technicians.userId,      users.id))
      .where(and(gte(timesheets.timestamp, start), lt(timesheets.timestamp, end)))
      .orderBy(timesheets.technicianId, timesheets.timestamp);

    const map = new Map<number, TechnicianTimesheetGroup>();
    for (const row of rows) {
      const tid = row.ts.technicianId;
      if (!map.has(tid)) {
        map.set(tid, {
          technicianId:    tid,
          technicianName:  row.userName  ?? `Tech #${tid}`,
          technicianColor: row.techColor ?? "#f97316",
          entries:         [],
        });
      }
      map.get(tid)!.entries.push({ ...row.ts, jobTitle: row.jobTitle ?? null });
    }

    // Fill in technicians with no entries so the admin sees the full roster.
    const allTechs = await techniciansRepository.getAll();
    for (const tech of allTechs) {
      if (!map.has(tech.id)) {
        map.set(tech.id, {
          technicianId:    tech.id,
          technicianName:  tech.user?.name ?? `Tech #${tech.id}`,
          technicianColor: tech.color      ?? "#f97316",
          entries:         [],
        });
      }
    }

    return Array.from(map.values()).sort((a, b) =>
      a.technicianName.localeCompare(b.technicianName),
    );
  },

  async getAllByRange(fromStr: string, toStr: string): Promise<TechnicianTimesheetGroup[]> {
    const { start } = dayBoundsCT(fromStr);
    const { end }   = dayBoundsCT(toStr);

    const rows = await db
      .select({
        ts:        timesheets,
        jobTitle:  jobs.title,
        userName:  users.name,
        techColor: technicians.color,
      })
      .from(timesheets)
      .leftJoin(jobs,         eq(timesheets.jobId,        jobs.id))
      .leftJoin(technicians,  eq(timesheets.technicianId, technicians.id))
      .leftJoin(users,        eq(technicians.userId,      users.id))
      .where(and(gte(timesheets.timestamp, start), lt(timesheets.timestamp, end)))
      .orderBy(timesheets.technicianId, timesheets.timestamp);

    const map = new Map<number, TechnicianTimesheetGroup>();
    for (const row of rows) {
      const tid = row.ts.technicianId;
      if (!map.has(tid)) {
        map.set(tid, {
          technicianId:    tid,
          technicianName:  row.userName  ?? `Tech #${tid}`,
          technicianColor: row.techColor ?? "#f97316",
          entries:         [],
        });
      }
      map.get(tid)!.entries.push({ ...row.ts, jobTitle: row.jobTitle ?? null });
    }

    const allTechs = await techniciansRepository.getAll();
    for (const tech of allTechs) {
      if (!map.has(tech.id)) {
        map.set(tech.id, {
          technicianId:    tech.id,
          technicianName:  tech.user?.name ?? `Tech #${tech.id}`,
          technicianColor: tech.color      ?? "#f97316",
          entries:         [],
        });
      }
    }

    return Array.from(map.values()).sort((a, b) =>
      a.technicianName.localeCompare(b.technicianName),
    );
  },

  // ── Earnings ───────────────────────────────────────────────────────────────

  /**
   * Computes earnings for a technician over a date range.
   * Fetches the current hourlyRate, time entries, and approval snapshots,
   * then delegates the calculation to timesheetsDomainService.
   */
  async getEarnings(technicianId: number, fromStr: string, toStr: string) {
    const { start } = dayBoundsCT(fromStr);
    const { end }   = dayBoundsCT(toStr);

    const [tech] = await db
      .select({ hourlyRate: technicians.hourlyRate })
      .from(technicians)
      .where(eq(technicians.id, technicianId));
    const currentRate = Number(tech?.hourlyRate ?? 25);

    const rows = await db
      .select({ ts: timesheets, jobTitle: jobs.title })
      .from(timesheets)
      .leftJoin(jobs, eq(timesheets.jobId, jobs.id))
      .where(
        and(
          eq(timesheets.technicianId, technicianId),
          gte(timesheets.timestamp, start),
          lt(timesheets.timestamp, end),
        ),
      )
      .orderBy(timesheets.timestamp);

    const allDates = Array.from(
      new Set(rows.map((r) => r.ts.timestamp.toISOString().slice(0, 10))),
    );
    const approvalsMap = allDates.length > 0
      ? await timesheetsRepository.getApprovals(technicianId, allDates)
      : {} as ApprovalMap;

    const result = timesheetsDomainService.computeEarnings(rows, currentRate, approvalsMap);
    return { hourlyRate: currentRate, ...result };
  },
};
