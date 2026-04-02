import { useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { X, Plus, ChevronDown } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getNavItems, type SidebarNavItem, type UserRole } from "@/lib/routeConfig";

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const [location, navigate] = useLocation();
  const { user } = useAuth();

  const isTechnician = user?.role === "technician";
  const { totalUnread } = useUnreadMessages(user);

  const { data: conversations = [] } = useQuery<Array<{ unreadCount: number }>>({
    queryKey: ["/api/conversations"],
    queryFn: () => apiRequest("GET", "/api/conversations").then(r => r.json()),
    select: (d) => Array.isArray(d) ? d : [],
    refetchInterval: 60_000,
    staleTime: 30_000,
    enabled: !!user,
  });
  const { data: jobChats = [] } = useQuery<Array<{ unreadCount: number }>>({
    queryKey: ["/api/conversations/job-list"],
    queryFn: () => apiRequest("GET", "/api/conversations/job-list").then(r => r.json()),
    select: (d) => Array.isArray(d) ? d : [],
    refetchInterval: 60_000,
    staleTime: 30_000,
    enabled: !!user,
  });
  const chatUnreadTotal = conversations.reduce((s, c) => s + (c.unreadCount ?? 0), 0)
    + jobChats.reduce((s, j) => s + (j.unreadCount ?? 0), 0);

  const { data: techProfile } = useQuery<{ status?: string } | null>({
    queryKey: ["/api/technicians/me"],
    queryFn: () => apiRequest("GET", "/api/technicians/me").then(r => r.json()).catch(() => null),
    enabled: isTechnician,
    staleTime: 60 * 1000,
  });

  // Nav items derived from the centralized route config — single source of truth
  const navItems: SidebarNavItem[] = user?.role
    ? getNavItems(user.role as UserRole)
    : [];

  const isActive = (path: string) => {
    if (path === "/" && !isTechnician) return location === "/";
    if (path === "/my-jobs")     return location === "/my-jobs";
    if (path === "/my-schedule") return location === "/my-schedule";
    return location.startsWith(path);
  };

  // Group items by section (only relevant for admin/dispatcher)
  const mainItems     = navItems.filter(i => !i.section || i.section === "main");
  const workflowItems = navItems.filter(i => i.section === "workflow");
  const manageItems   = navItems.filter(i => i.section === "manage");

  const renderNavItem = (item: SidebarNavItem) => {
    const active = isActive(item.path);
    return (
      <Link
        key={item.path}
        href={item.path}
        onClick={onMobileClose}
        className={cn(
          "nav-item",
          active && "active"
        )}
      >
        <Icon icon={item.icon} size={15} className="flex-shrink-0 opacity-90" />
        <span className="flex-1 truncate">{item.label}</span>
        {totalUnread > 0 && (item.path === "/jobs" || item.path === "/my-jobs") && (
          <span className="min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
            {totalUnread > 99 ? "99+" : totalUnread}
          </span>
        )}
        {chatUnreadTotal > 0 && item.path === "/chat" && (
          <span className="min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
            {chatUnreadTotal > 99 ? "99+" : chatUnreadTotal}
          </span>
        )}
      </Link>
    );
  };

  const content = (
    <div className="sidebar-dark flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
        <img src="/logo.png" alt="Fuse Pro Electric" className="h-9 w-auto flex-shrink-0" />
        {onMobileClose && (
          <button
            onClick={onMobileClose}
            className="ml-auto opacity-50 hover:opacity-100 lg:hidden transition-opacity text-foreground"
          >
            <Icon icon={X} size={20} />
          </button>
        )}
      </div>

      {/* Quick Create (admin/dispatcher only) */}
      {!isTechnician && (
        <div className="px-3 pt-3 pb-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center justify-between px-3 h-8 rounded-md text-sm font-semibold text-white transition-colors"
                style={{ backgroundColor: "hsl(25,95%,53%)" }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = "hsl(25,95%,46%)")}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = "hsl(25,95%,53%)")}
              >
                <span className="flex items-center gap-1.5">
                  <Icon icon={Plus} size={14} />
                  Quick Create
                </span>
                <Icon icon={ChevronDown} size={14} className="opacity-80" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem onClick={() => { navigate("/requests?new=1"); onMobileClose?.(); }}>
                New Request
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { navigate("/estimates?new=1"); onMobileClose?.(); }}>
                New Estimate
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { navigate("/jobs?new=1"); onMobileClose?.(); }}>
                New Job
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { navigate("/invoices?new=1"); onMobileClose?.(); }}>
                New Invoice
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { navigate("/customers?new=1"); onMobileClose?.(); }}>
                New Customer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-2 py-2 overflow-y-auto space-y-0.5">
        {isTechnician ? (
          navItems.map(renderNavItem)
        ) : (
          <>
            {mainItems.map(renderNavItem)}
            {workflowItems.length > 0 && (
              <>
                <div className="sidebar-section-label">Workflow</div>
                {workflowItems.map(renderNavItem)}
              </>
            )}
            {manageItems.length > 0 && (
              <>
                <div className="sidebar-section-label">Manage</div>
                {manageItems.map(renderNavItem)}
              </>
            )}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border">
        {isTechnician && techProfile && (
          // Shows the administrative availability label set by a dispatcher.
          // This is not a live operational status — real-time state is derived from timesheets.
          <div className="flex items-center gap-2 mb-2 px-1">
            <span
              className={cn(
                "w-2 h-2 rounded-full flex-shrink-0",
                (techProfile as any).status === "inactive"
                  ? "bg-muted-foreground/40"
                  : "bg-emerald-400"
              )}
            />
            <span className="text-xs opacity-60 capitalize">
              {(techProfile as any).status ?? "available"}
            </span>
          </div>
        )}
        <p className="text-[11px] text-center opacity-30">
          Fuse Pro Electric &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-56 lg:fixed lg:inset-y-0 lg:z-50">
        {content}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onMobileClose}
          />
          <div className="relative flex flex-col w-60 z-10">
            {content}
          </div>
        </div>
      )}
    </>
  );
}
