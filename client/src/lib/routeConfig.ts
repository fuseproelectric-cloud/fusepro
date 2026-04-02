/**
 * Centralized route and navigation policy.
 *
 * This file is the single source of truth for:
 *   - Which paths exist in the app
 *   - Which roles may access each path
 *   - Which nav items appear in the sidebar (and for which roles)
 *
 * App.tsx generates <Route> elements from APP_ROUTES.
 * Sidebar.tsx derives nav items via getNavItems(role).
 * ProtectedRoute checks allowedRoles before rendering a page.
 */

import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard, Briefcase, Calendar, Users, UserCheck,
  FileText, Receipt, Package, Settings, User, Clock,
  ClipboardList, MessageSquare, BookOpen, Inbox, Zap,
} from "lucide-react";

import { DashboardPage }        from "@/pages/DashboardPage";
import { JobsPage }             from "@/pages/JobsPage";
import { SchedulePage }         from "@/pages/SchedulePage";
import { TechniciansPage }      from "@/pages/TechniciansPage";
import { CustomersPage }        from "@/pages/CustomersPage";
import { CustomerDetailPage }   from "@/pages/CustomerDetailPage";
import { CustomerAddressPage }  from "@/pages/CustomerAddressPage";
import { EstimatesPage }        from "@/pages/EstimatesPage";
import { InvoicesPage }         from "@/pages/InvoicesPage";
import { InventoryPage }        from "@/pages/InventoryPage";
import { SettingsPage }         from "@/pages/SettingsPage";
import { MyJobsPage }           from "@/pages/MyJobsPage";
import { MySchedulePage }       from "@/pages/MySchedulePage";
import { JobDetailPage }        from "@/pages/JobDetailPage";
import { TimesheetPage }        from "@/pages/TimesheetPage";
import { AdminTimesheetPage }   from "@/pages/AdminTimesheetPage";
import { ChatPage }             from "@/pages/ChatPage";
import { DocsPage }             from "@/pages/DocsPage";
import { RequestsPage }         from "@/pages/RequestsPage";
import { ServicesPage }         from "@/pages/ServicesPage";
import { ConnecteamPage }       from "@/pages/ConnecteamPage";

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserRole = "admin" | "dispatcher" | "technician";

/**
 * One sidebar nav entry for a route.
 * Multiple entries per route allow different labels/icons/sections per role.
 */
export interface NavEntry {
  label:  string;
  icon:   LucideIcon;
  /** Section grouping used in the admin/dispatcher sidebar. Absent = no section (technician flat list). */
  section?: "main" | "workflow" | "manage";
  /**
   * Roles that see this nav entry.
   * Undefined = all roles permitted by the route's allowedRoles.
   */
  visibleToRoles?: UserRole[];
}

export interface AppRouteConfig {
  path:        string;
  component:   ComponentType;
  requiresAuth: boolean;
  /**
   * Roles that may access this route.
   * null  = any authenticated user.
   * roles = restricted to listed roles; others see ForbiddenPage.
   */
  allowedRoles: UserRole[] | null;
  /**
   * Sidebar nav entry (or entries for role-specific display variants).
   * Absent = route exists but is not shown in the sidebar.
   */
  nav?: NavEntry | NavEntry[];
}

/** Flat nav item shape used by Sidebar after `getNavItems()` resolution. */
export type SidebarNavItem = NavEntry & { path: string };

// ─── Route definitions ────────────────────────────────────────────────────────
//
// ORDER MATTERS: routes are registered in this order inside <Switch>.
// More-specific dynamic paths (e.g. /customers/:id/addresses/:addrId) appear
// before less-specific ones (/customers/:id) as a safe convention.
// The config order also determines sidebar item order within each section.

export const APP_ROUTES: AppRouteConfig[] = [

  // ── Technician-only routes ──────────────────────────────────────────────────
  {
    path:        "/my-jobs",
    component:   MyJobsPage,
    requiresAuth: true,
    allowedRoles: ["technician"],
    nav: { label: "My Jobs", icon: Briefcase },
  },
  {
    path:        "/my-schedule",
    component:   MySchedulePage,
    requiresAuth: true,
    allowedRoles: ["technician"],
    nav: { label: "My Schedule", icon: Calendar },
  },
  {
    path:        "/timesheet",
    component:   TimesheetPage,
    requiresAuth: true,
    allowedRoles: ["technician"],
    nav: { label: "Timesheet", icon: Clock },
  },

  // ── All authenticated roles — non-nav ───────────────────────────────────────
  {
    path:        "/job/:id",
    component:   JobDetailPage,
    requiresAuth: true,
    allowedRoles: null,
  },
  {
    path:        "/chat/:id",
    component:   ChatPage,
    requiresAuth: true,
    allowedRoles: null,
  },

  // ── Admin/Dispatcher — main section ────────────────────────────────────────
  {
    path:        "/",
    component:   DashboardPage,
    requiresAuth: true,
    allowedRoles: ["admin", "dispatcher"],
    nav: { label: "Dashboard", icon: LayoutDashboard, section: "main" },
  },

  // ── Admin/Dispatcher — workflow section ────────────────────────────────────
  {
    path:        "/requests",
    component:   RequestsPage,
    requiresAuth: true,
    allowedRoles: ["admin", "dispatcher"],
    nav: { label: "Requests", icon: Inbox, section: "workflow" },
  },
  {
    path:        "/estimates",
    component:   EstimatesPage,
    requiresAuth: true,
    allowedRoles: ["admin", "dispatcher"],
    nav: { label: "Estimates", icon: FileText, section: "workflow" },
  },
  {
    path:        "/jobs",
    component:   JobsPage,
    requiresAuth: true,
    allowedRoles: ["admin", "dispatcher"],
    nav: { label: "Jobs", icon: Briefcase, section: "workflow" },
  },
  {
    path:        "/schedule",
    component:   SchedulePage,
    requiresAuth: true,
    allowedRoles: ["admin", "dispatcher"],
    nav: { label: "Schedule", icon: Calendar, section: "workflow" },
  },
  {
    // Invoices is admin-only; dispatchers neither see nor access it
    path:        "/invoices",
    component:   InvoicesPage,
    requiresAuth: true,
    allowedRoles: ["admin"],
    nav: { label: "Invoices", icon: Receipt, section: "workflow" },
  },

  // ── Admin/Dispatcher — manage section ──────────────────────────────────────
  {
    // More-specific customer sub-route first
    path:        "/customers/:id/addresses/:addrId",
    component:   CustomerAddressPage,
    requiresAuth: true,
    allowedRoles: ["admin", "dispatcher"],
  },
  {
    path:        "/customers/:id",
    component:   CustomerDetailPage,
    requiresAuth: true,
    allowedRoles: ["admin", "dispatcher"],
  },
  {
    path:        "/customers",
    component:   CustomersPage,
    requiresAuth: true,
    allowedRoles: ["admin", "dispatcher"],
    nav: { label: "Customers", icon: Users, section: "manage" },
  },
  {
    path:        "/technicians",
    component:   TechniciansPage,
    requiresAuth: true,
    allowedRoles: ["admin", "dispatcher"],
    nav: { label: "Technicians", icon: UserCheck, section: "manage" },
  },
  {
    path:        "/admin/timesheets",
    component:   AdminTimesheetPage,
    requiresAuth: true,
    allowedRoles: ["admin", "dispatcher"],
    nav: { label: "Timesheets", icon: ClipboardList, section: "manage" },
  },

  // ── All authenticated roles — nav (section varies by role) ─────────────────
  {
    path:        "/inventory",
    component:   InventoryPage,
    requiresAuth: true,
    allowedRoles: null,
    nav: [
      { label: "Inventory", icon: Package, section: "manage", visibleToRoles: ["admin", "dispatcher"] },
      { label: "Inventory", icon: Package,                    visibleToRoles: ["technician"] },
    ],
  },
  {
    path:        "/chat",
    component:   ChatPage,
    requiresAuth: true,
    allowedRoles: null,
    nav: [
      { label: "Team Chat", icon: MessageSquare, section: "manage", visibleToRoles: ["admin", "dispatcher"] },
      { label: "Team Chat", icon: MessageSquare,                    visibleToRoles: ["technician"] },
    ],
  },
  {
    // Admin sees "Settings" in manage; technician sees "Profile"; dispatcher sees neither
    path:        "/settings",
    component:   SettingsPage,
    requiresAuth: true,
    allowedRoles: null,
    nav: [
      { label: "Settings", icon: Settings, section: "manage", visibleToRoles: ["admin"] },
      { label: "Profile",  icon: User,                        visibleToRoles: ["technician"] },
    ],
  },

  // ── Admin/Dispatcher — non-nav ──────────────────────────────────────────────
  {
    path:        "/services",
    component:   ServicesPage,
    requiresAuth: true,
    allowedRoles: ["admin", "dispatcher"],
  },

  // ── Admin-only — manage section ─────────────────────────────────────────────
  {
    path:        "/integrations/connecteam",
    component:   ConnecteamPage,
    requiresAuth: true,
    allowedRoles: ["admin"],
    nav: { label: "Connecteam", icon: Zap, section: "manage" },
  },
  {
    path:        "/docs",
    component:   DocsPage,
    requiresAuth: true,
    allowedRoles: ["admin"],
    nav: { label: "Docs", icon: BookOpen, section: "manage" },
  },
];

// ─── Helper functions ─────────────────────────────────────────────────────────

/**
 * Returns sidebar nav items visible to the given role, in config order.
 * Items are filtered by both route allowedRoles and nav entry visibleToRoles.
 */
export function getNavItems(role: UserRole): SidebarNavItem[] {
  const items: SidebarNavItem[] = [];
  for (const route of APP_ROUTES) {
    if (!route.nav) continue;
    // Skip routes the role cannot access
    if (route.allowedRoles !== null && !route.allowedRoles.includes(role)) continue;
    const entries = Array.isArray(route.nav) ? route.nav : [route.nav];
    for (const entry of entries) {
      const visible = !entry.visibleToRoles || entry.visibleToRoles.includes(role);
      if (visible) {
        items.push({ path: route.path, ...entry });
      }
    }
  }
  return items;
}

/** Returns the default landing route for the given role after login. */
export function getHomeRoute(role: UserRole): string {
  return role === "technician" ? "/my-jobs" : "/";
}
