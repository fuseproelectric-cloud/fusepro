import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { X, Plus, ChevronDown } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { SIDEBAR_W } from "@/lib/layout";
import {
  Box,
  Button,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material";
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

  const getUnreadCount = (item: SidebarNavItem) => {
    if (totalUnread > 0 && (item.path === "/jobs" || item.path === "/my-jobs")) return totalUnread;
    if (chatUnreadTotal > 0 && item.path === "/chat") return chatUnreadTotal;
    return 0;
  };

  const renderNavItem = (item: SidebarNavItem) => {
    const active = isActive(item.path);
    const unread = getUnreadCount(item);
    return (
      <ListItemButton
        key={item.path}
        onClick={() => { navigate(item.path); onMobileClose?.(); }}
        selected={active}
        sx={{
          py: 0.875,
          px: 1.25,
          mb: 0.25,
          gap: 1.25,
        }}
      >
        <ListItemIcon sx={{ minWidth: 0, color: active ? "primary.main" : "text.secondary" }}>
          <Icon icon={item.icon} size={15} />
        </ListItemIcon>
        <ListItemText
          primary={item.label}
          primaryTypographyProps={{
            fontSize: 13.5,
            fontWeight: active ? 600 : 500,
            color: active ? "primary.main" : "text.secondary",
            noWrap: true,
          }}
        />
        {unread > 0 && (
          <Box
            sx={{
              minWidth: 18,
              height: 18,
              borderRadius: "50%",
              bgcolor: "error.main",
              color: "white",
              fontSize: 10,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              px: 0.5,
            }}
          >
            {unread > 99 ? "99+" : unread}
          </Box>
        )}
      </ListItemButton>
    );
  };

  const renderSectionLabel = (label: string) => (
    <Typography
      variant="overline"
      sx={{
        display: "block",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.08em",
        color: "text.disabled",
        px: 1.25,
        mb: 0.25,
        mt: 1.5,
      }}
    >
      {label}
    </Typography>
  );

  const content = (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", bgcolor: "background.paper" }}>
      {/* Logo */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 2, py: 1.75, borderBottom: 1, borderColor: "divider" }}>
        <Box component="img" src="/logo.png" alt="Fuse Pro Electric" sx={{ height: 36, width: "auto", flexShrink: 0 }} />
        {onMobileClose && (
          <IconButton
            onClick={onMobileClose}
            size="small"
            sx={{ ml: "auto", display: { lg: "none" }, opacity: 0.5, "&:hover": { opacity: 1 } }}
          >
            <Icon icon={X} size={20} />
          </IconButton>
        )}
      </Box>

      {/* Quick Create (admin/dispatcher only) */}
      {!isTechnician && (
        <Box sx={{ px: 1.5, pt: 1.5, pb: 0.5 }}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="contained"
                fullWidth
                size="small"
                sx={{
                  justifyContent: "space-between",
                  fontWeight: 600,
                  textTransform: "none",
                  fontSize: 13.5,
                  px: 1.5,
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                  <Icon icon={Plus} size={14} />
                  Quick Create
                </Box>
                <Box component="span" sx={{ opacity: 0.8, display: "flex" }}><Icon icon={ChevronDown} size={14} /></Box>
              </Button>
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
        </Box>
      )}

      {/* Navigation */}
      <List dense disablePadding sx={{ flex: 1, px: 1, py: 1, overflowY: "auto" }}>
        {isTechnician ? (
          navItems.map(renderNavItem)
        ) : (
          <>
            {mainItems.map(renderNavItem)}
            {workflowItems.length > 0 && (
              <>
                {renderSectionLabel("Workflow")}
                {workflowItems.map(renderNavItem)}
              </>
            )}
            {manageItems.length > 0 && (
              <>
                {renderSectionLabel("Manage")}
                {manageItems.map(renderNavItem)}
              </>
            )}
          </>
        )}
      </List>

      {/* Footer */}
      <Box sx={{ px: 2, py: 1.5, borderTop: 1, borderColor: "divider" }}>
        {isTechnician && techProfile && (
          // Shows the administrative availability label set by a dispatcher.
          // This is not a live operational status — real-time state is derived from timesheets.
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1, px: 0.5 }}>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                flexShrink: 0,
                bgcolor: techProfile.status === "inactive" ? "text.disabled" : "success.light",
              }}
            />
            <Typography variant="caption" sx={{ opacity: 0.6, textTransform: "capitalize" }}>
              {techProfile.status ?? "available"}
            </Typography>
          </Box>
        )}
        <Typography variant="caption" sx={{ display: "block", textAlign: "center", opacity: 0.3 }}>
          Fuse Pro Electric &copy; {new Date().getFullYear()}
        </Typography>
      </Box>
    </Box>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <Box
        component="aside"
        sx={{
          display: { xs: "none", lg: "flex" },
          flexDirection: "column",
          width: SIDEBAR_W,
          position: "fixed",
          top: 0,
          bottom: 0,
          left: 0,
          zIndex: "appBar",
          borderRight: 1,
          borderColor: "divider",
        }}
      >
        {content}
      </Box>

      {/* Mobile overlay */}
      <Drawer
        open={!!mobileOpen}
        onClose={onMobileClose}
        variant="temporary"
        sx={{
          display: { lg: "none" },
          "& .MuiDrawer-paper": { width: 240, boxSizing: "border-box" },
        }}
      >
        {content}
      </Drawer>
    </>
  );
}
