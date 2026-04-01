import { apiRequest } from "./queryClient";
import type { InsertCustomer, InsertCustomerAddress, InsertJob, InsertTechnician, InsertEstimate, InsertInvoice, InsertInventoryItem, InsertRequest, InsertService } from "@shared/schema";

// Auth
export const authApi = {
  login: async (email: string, password: string) => {
    const res = await apiRequest("POST", "/api/auth/login", { email, password });
    return res.json();
  },
  logout: async () => {
    const res = await apiRequest("POST", "/api/auth/logout");
    return res.json();
  },
  me: async () => {
    const res = await fetch("/api/auth/me", { credentials: "include" });
    if (res.status === 401) return null;
    if (!res.ok) throw new Error("Failed to fetch user");
    return res.json();
  },
  changePassword: async (currentPassword: string, newPassword: string) => {
    const res = await apiRequest("PUT", "/api/auth/password", { currentPassword, newPassword });
    return res.json();
  },
};

// Customers
export const customersApi = {
  getAll: async () => {
    const res = await apiRequest("GET", "/api/customers");
    return res.json();
  },
  getById: async (id: number) => {
    const res = await apiRequest("GET", `/api/customers/${id}`);
    return res.json();
  },
  create: async (data: Partial<InsertCustomer>) => {
    const res = await apiRequest("POST", "/api/customers", data);
    return res.json();
  },
  update: async (id: number, data: Partial<InsertCustomer>) => {
    const res = await apiRequest("PUT", `/api/customers/${id}`, data);
    return res.json();
  },
  delete: async (id: number) => {
    const res = await apiRequest("DELETE", `/api/customers/${id}`);
    return res.json();
  },
  getAddresses: async (customerId: number) => {
    const res = await apiRequest("GET", `/api/customers/${customerId}/addresses`);
    return res.json();
  },
  createAddress: async (customerId: number, data: Partial<InsertCustomerAddress>) => {
    const res = await apiRequest("POST", `/api/customers/${customerId}/addresses`, data);
    return res.json();
  },
  updateAddress: async (customerId: number, id: number, data: Partial<InsertCustomerAddress>) => {
    const res = await apiRequest("PUT", `/api/customers/${customerId}/addresses/${id}`, data);
    return res.json();
  },
  deleteAddress: async (customerId: number, id: number) => {
    const res = await apiRequest("DELETE", `/api/customers/${customerId}/addresses/${id}`);
    return res.json();
  },
  getRequests: async (customerId: number) => {
    const res = await apiRequest("GET", `/api/customers/${customerId}/requests`);
    return res.json();
  },
};

// Jobs
export const jobsApi = {
  getAll: async () => {
    const res = await apiRequest("GET", "/api/jobs");
    return res.json();
  },
  getById: async (id: number) => {
    const res = await apiRequest("GET", `/api/jobs/${id}`);
    return res.json();
  },
  create: async (data: Partial<InsertJob>) => {
    const res = await apiRequest("POST", "/api/jobs", data);
    return res.json();
  },
  update: async (id: number, data: Partial<InsertJob>) => {
    const res = await apiRequest("PUT", `/api/jobs/${id}`, data);
    return res.json();
  },
  delete: async (id: number) => {
    const res = await apiRequest("DELETE", `/api/jobs/${id}`);
    return res.json();
  },
  addNote: async (jobId: number, content: string) => {
    const res = await apiRequest("POST", `/api/jobs/${jobId}/notes`, { content });
    return res.json();
  },
};

// Technicians
export const techniciansApi = {
  getAll: async () => {
    const res = await apiRequest("GET", "/api/technicians");
    return res.json();
  },
  getById: async (id: number) => {
    const res = await apiRequest("GET", `/api/technicians/${id}`);
    return res.json();
  },
  create: async (data: Partial<InsertTechnician>) => {
    const res = await apiRequest("POST", "/api/technicians", data);
    return res.json();
  },
  update: async (id: number, data: Partial<InsertTechnician>) => {
    const res = await apiRequest("PUT", `/api/technicians/${id}`, data);
    return res.json();
  },
  delete: async (id: number) => {
    const res = await apiRequest("DELETE", `/api/technicians/${id}`);
    return res.json();
  },
};

// Estimates
export const estimatesApi = {
  getAll: async () => {
    const res = await apiRequest("GET", "/api/estimates");
    return res.json();
  },
  getById: async (id: number) => {
    const res = await apiRequest("GET", `/api/estimates/${id}`);
    return res.json();
  },
  create: async (data: Partial<InsertEstimate>) => {
    const res = await apiRequest("POST", "/api/estimates", data);
    return res.json();
  },
  update: async (id: number, data: Partial<InsertEstimate>) => {
    const res = await apiRequest("PUT", `/api/estimates/${id}`, data);
    return res.json();
  },
  delete: async (id: number) => {
    const res = await apiRequest("DELETE", `/api/estimates/${id}`);
    return res.json();
  },
  convertToInvoice: async (id: number, options?: { paymentTerms?: string }) => {
    const res = await apiRequest("POST", `/api/estimates/${id}/convert-invoice`, options ?? {});
    return res.json();
  },
};

// Invoices
export const invoicesApi = {
  getAll: async () => {
    const res = await apiRequest("GET", "/api/invoices");
    return res.json();
  },
  getById: async (id: number) => {
    const res = await apiRequest("GET", `/api/invoices/${id}`);
    return res.json();
  },
  create: async (data: Partial<InsertInvoice>) => {
    const res = await apiRequest("POST", "/api/invoices", data);
    return res.json();
  },
  update: async (id: number, data: Partial<InsertInvoice>) => {
    const res = await apiRequest("PUT", `/api/invoices/${id}`, data);
    return res.json();
  },
  delete: async (id: number) => {
    const res = await apiRequest("DELETE", `/api/invoices/${id}`);
    return res.json();
  },
  markPaid: async (id: number) => {
    const res = await apiRequest("PUT", `/api/invoices/${id}`, { status: "paid" });
    return res.json();
  },
};

// Inventory
export const inventoryApi = {
  getAll: async () => {
    const res = await apiRequest("GET", "/api/inventory");
    return res.json();
  },
  getById: async (id: number) => {
    const res = await apiRequest("GET", `/api/inventory/${id}`);
    return res.json();
  },
  create: async (data: Partial<InsertInventoryItem>) => {
    const res = await apiRequest("POST", "/api/inventory", data);
    return res.json();
  },
  update: async (id: number, data: Partial<InsertInventoryItem>) => {
    const res = await apiRequest("PUT", `/api/inventory/${id}`, data);
    return res.json();
  },
  delete: async (id: number) => {
    const res = await apiRequest("DELETE", `/api/inventory/${id}`);
    return res.json();
  },
};

// Users (admin)
export const usersApi = {
  getAll: async () => {
    const res = await apiRequest("GET", "/api/users");
    return res.json();
  },
  create: async (data: { email: string; password: string; name: string; role: string }) => {
    const res = await apiRequest("POST", "/api/users", data);
    return res.json();
  },
  update: async (id: number, data: Partial<{ name: string; email: string; role: string; password: string }>) => {
    const res = await apiRequest("PUT", `/api/users/${id}`, data);
    return res.json();
  },
  delete: async (id: number) => {
    const res = await apiRequest("DELETE", `/api/users/${id}`);
    return res.json();
  },
};

// Settings
export const settingsApi = {
  getAll: async () => {
    const res = await apiRequest("GET", "/api/settings");
    return res.json();
  },
  update: async (key: string, value: string) => {
    const res = await apiRequest("PUT", `/api/settings/${key}`, { value });
    return res.json();
  },
};

// Dashboard
export const dashboardApi = {
  getStats: async () => {
    const res = await apiRequest("GET", "/api/dashboard/stats");
    return res.json();
  },
};

// Timesheet
export const timesheetApi = {
  getToday: async () => {
    const res = await apiRequest("GET", "/api/timesheet/today");
    return res.json();
  },
  getWeek: async () => {
    const res = await apiRequest("GET", "/api/timesheet/week");
    return res.json();
  },
  createEntry: async (data: { entryType: string; jobId?: number; notes?: string; lat?: number; lng?: number; address?: string }) => {
    const res = await apiRequest("POST", "/api/timesheet", data);
    return res.json();
  },
};

export const jobMaterialsApi = {
  getAll: async (jobId: number) => {
    const res = await apiRequest("GET", `/api/jobs/${jobId}/materials`);
    return res.json();
  },
  create: async (jobId: number, data: any) => {
    const res = await apiRequest("POST", `/api/jobs/${jobId}/materials`, data);
    return res.json();
  },
  delete: async (jobId: number, materialId: number) => {
    const res = await apiRequest("DELETE", `/api/jobs/${jobId}/materials/${materialId}`);
    return res.json();
  },
};

// Requests
export const requestsApi = {
  getAll: async () => {
    const res = await apiRequest("GET", "/api/requests");
    return res.json();
  },
  getById: async (id: number) => {
    const res = await apiRequest("GET", `/api/requests/${id}`);
    return res.json();
  },
  create: async (data: Partial<InsertRequest>) => {
    const res = await apiRequest("POST", "/api/requests", data);
    return res.json();
  },
  update: async (id: number, data: Partial<InsertRequest>) => {
    const res = await apiRequest("PUT", `/api/requests/${id}`, data);
    return res.json();
  },
  delete: async (id: number) => {
    const res = await apiRequest("DELETE", `/api/requests/${id}`);
    return res.json();
  },
  convertToEstimate: async (id: number) => {
    const res = await apiRequest("POST", `/api/requests/${id}/convert-estimate`);
    return res.json();
  },
  convertToJob: async (id: number) => {
    const res = await apiRequest("POST", `/api/requests/${id}/convert-job`);
    return res.json();
  },
  getConvertedEntity: async (id: number): Promise<{ type: "estimate" | "job"; id: number }> => {
    const res = await apiRequest("GET", `/api/requests/${id}/converted-entity`);
    return res.json();
  },
};

// Services (Products & Services catalog)
export const servicesApi = {
  getAll: async () => {
    const res = await apiRequest("GET", "/api/services");
    return res.json();
  },
  create: async (data: Partial<InsertService>) => {
    const res = await apiRequest("POST", "/api/services", data);
    return res.json();
  },
  update: async (id: number, data: Partial<InsertService>) => {
    const res = await apiRequest("PUT", `/api/services/${id}`, data);
    return res.json();
  },
  delete: async (id: number) => {
    const res = await apiRequest("DELETE", `/api/services/${id}`);
    return res.json();
  },
};

// Connecteam Integration
export const connecteamApi = {
  getSettings: async () => {
    const res = await apiRequest("GET", "/api/integrations/connecteam");
    return res.json();
  },
  saveSettings: async (data: { clientId?: string; clientSecret?: string; enabled?: boolean }) => {
    const res = await apiRequest("PUT", "/api/integrations/connecteam", data);
    return res.json();
  },
  testConnection: async () => {
    const res = await apiRequest("POST", "/api/integrations/connecteam/test");
    return res.json();
  },
  getUsers: async () => {
    const res = await apiRequest("GET", "/api/integrations/connecteam/users");
    return res.json();
  },
  getJobs: async () => {
    const res = await apiRequest("GET", "/api/integrations/connecteam/jobs");
    return res.json();
  },
  getTime: async (startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate);
    if (endDate)   params.set("endDate", endDate);
    const res = await apiRequest("GET", `/api/integrations/connecteam/time?${params}`);
    return res.json();
  },
  syncEmployees: async () => {
    const res = await apiRequest("POST", "/api/integrations/connecteam/sync-employees");
    return res.json();
  },
};

// My Jobs (technician)
export const myJobsApi = {
  getAll: async () => {
    const res = await apiRequest("GET", "/api/jobs/my");
    return res.json();
  },
  getMyStats: async () => {
    const res = await apiRequest("GET", "/api/dashboard/my-stats");
    return res.json();
  },
};
