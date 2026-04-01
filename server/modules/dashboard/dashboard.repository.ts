import { eq, desc, and, gte, lt, count, inArray } from "drizzle-orm";
import { db } from "../../db";
import { jobs, customers, technicians, invoices, users } from "@shared/schema";
import type { Job } from "@shared/schema";
import type { DashboardStats } from "@shared/routes";
import { dayBoundsCT, monthStartCT } from "../../lib/time";

export const dashboardRepository = {
  async getStats(): Promise<DashboardStats> {
    const { start: startOfDay, end: endOfDay } = dayBoundsCT();
    const startOfMonth = monthStartCT();

    const [totalJobsRes] = await db.select({ cnt: count() }).from(jobs);
    const totalJobs = totalJobsRes?.cnt ?? 0;

    const [pendingRes] = await db.select({ cnt: count() }).from(jobs).where(eq(jobs.status, "pending"));
    const pendingJobs = pendingRes?.cnt ?? 0;

    const [inProgressRes] = await db.select({ cnt: count() }).from(jobs).where(eq(jobs.status, "in_progress"));
    const inProgressJobs = inProgressRes?.cnt ?? 0;

    const [completedTodayRes] = await db
      .select({ cnt: count() })
      .from(jobs)
      .where(and(eq(jobs.status, "completed"), gte(jobs.completedAt, startOfDay), lt(jobs.completedAt, endOfDay)));
    const completedJobsToday = completedTodayRes?.cnt ?? 0;

    const [totalTechRes] = await db.select({ cnt: count() }).from(technicians);
    const totalTechnicians = totalTechRes?.cnt ?? 0;

    // Reads the admin-managed availability label, not a live computed state.
    // technicians.status is set manually by dispatchers; 'on_job' is never auto-set.
    const [activeTechRes] = await db
      .select({ cnt: count() })
      .from(technicians)
      .where(eq(technicians.status, "available"));
    const activeTechnicians = activeTechRes?.cnt ?? 0;

    const [totalCustRes] = await db.select({ cnt: count() }).from(customers);
    const totalCustomers = totalCustRes?.cnt ?? 0;

    const paidInvoices = await db
      .select({ total: invoices.total })
      .from(invoices)
      .where(and(eq(invoices.status, "paid"), gte(invoices.paidAt, startOfMonth)));
    const revenueThisMonth = paidInvoices.reduce((sum, inv) => sum + parseFloat(inv.total ?? "0"), 0);

    // Jobs by status counts
    const statusGroups = await db
      .select({ status: jobs.status, cnt: count() })
      .from(jobs)
      .groupBy(jobs.status);
    const jobsByStatus = statusGroups.map((row) => ({ status: row.status, count: row.cnt }));

    // Recent jobs with customer + technician names
    const recentJobRows = await db
      .select({
        id: jobs.id,
        title: jobs.title,
        status: jobs.status,
        priority: jobs.priority,
        scheduledAt: jobs.scheduledAt,
        createdAt: jobs.createdAt,
        customerName: customers.name,
        techUserId: technicians.userId,
      })
      .from(jobs)
      .leftJoin(customers, eq(jobs.customerId, customers.id))
      .leftJoin(technicians, eq(jobs.technicianId, technicians.id))
      .orderBy(desc(jobs.createdAt))
      .limit(5);

    // Fetch technician names
    const techUserIds = recentJobRows
      .map((r) => r.techUserId)
      .filter((id): id is number => id !== null && id !== undefined);

    const techUsers = techUserIds.length > 0
      ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, techUserIds))
      : [];

    const techUserMap = new Map(techUsers.map((u) => [u.id, u.name]));

    const recentJobs = recentJobRows.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      priority: r.priority,
      customerName: r.customerName ?? "Unknown",
      technicianName: r.techUserId ? (techUserMap.get(r.techUserId) ?? null) : null,
      scheduledAt: r.scheduledAt ? r.scheduledAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
    }));

    return {
      totalJobs,
      pendingJobs,
      inProgressJobs,
      completedJobsToday,
      totalTechnicians,
      activeTechnicians,
      totalCustomers,
      revenueThisMonth,
      jobsByStatus,
      recentJobs,
    };
  },

  async getMyStats(technicianId: number): Promise<{
    myJobsToday: number;
    myInProgress: number;
    myCompleted: number;
    myCompletedThisMonth: number;
    upcomingJobs: (Job & { customerName?: string | null })[];
  }> {
    const { start: startOfDay, end: endOfDay } = dayBoundsCT();
    const startOfMonth = monthStartCT();

    const [todayRes] = await db
      .select({ cnt: count() })
      .from(jobs)
      .where(and(
        eq(jobs.technicianId, technicianId),
        gte(jobs.scheduledAt, startOfDay),
        lt(jobs.scheduledAt, endOfDay)
      ));

    const [inProgressRes] = await db
      .select({ cnt: count() })
      .from(jobs)
      .where(and(eq(jobs.technicianId, technicianId), eq(jobs.status, "in_progress")));

    const [completedRes] = await db
      .select({ cnt: count() })
      .from(jobs)
      .where(and(eq(jobs.technicianId, technicianId), eq(jobs.status, "completed")));

    const [completedMonthRes] = await db
      .select({ cnt: count() })
      .from(jobs)
      .where(and(
        eq(jobs.technicianId, technicianId),
        eq(jobs.status, "completed"),
        gte(jobs.completedAt, startOfMonth)
      ));

    const upcomingRows = await db
      .select({ job: jobs, customerName: customers.name })
      .from(jobs)
      .leftJoin(customers, eq(jobs.customerId, customers.id))
      .where(and(
        eq(jobs.technicianId, technicianId),
        gte(jobs.scheduledAt, new Date())
      ))
      .orderBy(jobs.scheduledAt)
      .limit(5);

    return {
      myJobsToday: todayRes?.cnt ?? 0,
      myInProgress: inProgressRes?.cnt ?? 0,
      myCompleted: completedRes?.cnt ?? 0,
      myCompletedThisMonth: completedMonthRes?.cnt ?? 0,
      upcomingJobs: upcomingRows.map((r) => ({ ...r.job, customerName: r.customerName ?? null })),
    };
  },

  async getTechnicianByUserId(userId: number) {
    const [tech] = await db.select().from(technicians).where(eq(technicians.userId, userId));
    return tech;
  },
};
