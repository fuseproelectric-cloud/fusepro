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
 *
 * All page components are lazy-loaded so they are only fetched when first
 * visited. The shell (AppLayout: sidebar + header) is always eager.
 */

import { lazy, type ComponentType } from "react";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard, Briefcase, Calendar, Users, UserCheck,
  FileText, Receipt, Package, Settings, User, Clock,
  ClipboardList, MessageSquare, BookOpen, Inbox, Zap,
} from "lucide-react";

// ── Lazy page components ──────────────────────────────────────────────────────
// Each page is a separate async chunk. The shell loads eagerly; page content
// fetches on first visit.

const DashboardPage       = lazy(() => import("@/pages/DashboardPage").then(m => ({ default: m.DashboardPage })));
const JobsPage            = lazy(() => import("@/pages/JobsPage").then(m => ({ default: m.JobsPage })));
const SchedulePage        = lazy(() => import("@/pages/SchedulePage").then(m => ({ default: m.SchedulePage })));
const TechniciansPage     = lazy(() => import("@/pages/TechniciansPage").then(m => ({ default: m.TechniciansPage })));
const CustomersPage       = lazy(() => import("@/pages/CustomersPage").then(m => ({ default: m.CustomersPage })));
const CustomerDetailPage  = lazy(() => import("@/pages/CustomerDetailPage").then(m => ({ default: m.CustomerDetailPage })));
const CustomerAddressPage = lazy(() => import("@/pages/CustomerAddressPage").then(m => ({ default: m.CustomerAddressPage })));
const EstimatesPage       = lazy(() => import("@/pages/EstimatesPage").then(m => ({ default: m.EstimatesPage })));
const InvoicesPage        = lazy(() => import("@/pages/InvoicesPage").then(m => ({ default: m.InvoicesPage })));
const InventoryPage       = lazy(() => import("@/pages/InventoryPage").then(m => ({ default: m.InventoryPage })));
const SettingsPage        = lazy(() => import("@/pages/SettingsPage").then(m => ({ default: m.SettingsPage })));
const MyJobsPage          = lazy(() => import("@/pages/MyJobsPage").then(m => ({ default: m.MyJobsPage })));
const MySchedulePage      = lazy(() => import("@/pages/MySchedulePage").then(m => ({ default: m.MySchedulePage })));
const JobDetailPage       = lazy(() => import("@/pages/JobDetailPage").then(m => ({ default: m.JobDetailPage })));
const TimesheetPage       = lazy(() => import("@/pages/TimesheetPage").then(m => ({ default: m.TimesheetPage })));
const AdminTimesheetPage  = lazy(() => import("@/pages/AdminTimesheetPage").then(m => ({ default: m.AdminTimesheetPage })));
const ChatPage            = lazy(() => import("@/pages/ChatPage").then(m => ({ default: m.ChatPage })));
const DocsPage            = lazy(() => import("@/pages/DocsPage").then(m => ({ default: m.DocsPage })));
const RequestsPage        = lazy(() => import("@/pages/RequestsPage").then(m => ({ default: m.RequestsPage })));
const ServicesPage        = lazy(() => import("@/pages/ServicesPage").then(m => ({ default: m.ServicesPage })));
const ConnecteamPage      = lazy(() => import("@/pages/ConnecteamPage").then(m => ({ default: m.ConnecteamPage })));

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
