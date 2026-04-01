// Typed API route definitions for Fuse Pro Cloud FSM

export const API_ROUTES = {
  // Auth
  AUTH_LOGIN: "/api/auth/login",
  AUTH_LOGOUT: "/api/auth/logout",
  AUTH_ME: "/api/auth/me",

  // Dashboard
  DASHBOARD_STATS: "/api/dashboard/stats",

  // Customers
  CUSTOMERS: "/api/customers",
  CUSTOMER: (id: number | string) => `/api/customers/${id}`,

  // Jobs
  JOBS: "/api/jobs",
  JOB: (id: number | string) => `/api/jobs/${id}`,
  JOB_NOTES: (id: number | string) => `/api/jobs/${id}/notes`,

  // Technicians
  TECHNICIANS: "/api/technicians",
  TECHNICIAN: (id: number | string) => `/api/technicians/${id}`,

  // Estimates
  ESTIMATES: "/api/estimates",
  ESTIMATE: (id: number | string) => `/api/estimates/${id}`,

  // Invoices
  INVOICES: "/api/invoices",
  INVOICE: (id: number | string) => `/api/invoices/${id}`,

  // Inventory
  INVENTORY: "/api/inventory",
  INVENTORY_ITEM: (id: number | string) => `/api/inventory/${id}`,

  // Settings
  SETTINGS: "/api/settings",
  SETTING: (key: string) => `/api/settings/${key}`,

  // Users (admin)
  USERS: "/api/users",
  USER: (id: number | string) => `/api/users/${id}`,
} as const;

// API response types
export interface DashboardStats {
  totalJobs: number;
  pendingJobs: number;
  inProgressJobs: number;
  completedJobsToday: number;
  totalTechnicians: number;
  activeTechnicians: number;
  totalCustomers: number;
  revenueThisMonth: number;
  jobsByStatus: Array<{ status: string; count: number }>;
  recentJobs: Array<{
    id: number;
    title: string;
    status: string;
    priority: string;
    customerName: string;
    technicianName: string | null;
    scheduledAt: string | null;
    createdAt: string;
  }>;
}

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: string;
}
