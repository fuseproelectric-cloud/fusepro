import { Bell, Menu, ChevronDown, User, LogOut, MessageSquare } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useUnreadMessages, markJobRead, clearActivityNotification, getActivityIcon } from "@/hooks/useUnreadMessages";

interface HeaderProps {
  onMobileMenuToggle: () => void;
}

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/jobs": "Jobs",
  "/schedule": "Schedule",
  "/technicians": "Technicians",
  "/customers": "Customers",
  "/estimates": "Estimates",
  "/invoices": "Invoices",
  "/inventory": "Inventory",
  "/admin/timesheets": "Timesheets",
  "/chat": "Team Chat",
  "/settings": "Settings",
};

function getPageTitle(location: string): string {
  if (location === "/") return "Dashboard";
  const match = Object.entries(PAGE_TITLES).find(
    ([key]) => key !== "/" && location.startsWith(key)
  );
  return match ? match[1] : "Fuse Pro Cloud";
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function Header({ onMobileMenuToggle }: HeaderProps) {
  const { user, logout } = useAuth();
  const [location, navigate] = useLocation();
  const title = getPageTitle(location);
  const { totalUnread, notifications } = useUnreadMessages(user);

  const handleLogout = async () => {
    await logout();
  };

  return (
    <header className="sticky top-0 z-40 bg-card border-b border-border" style={{ boxShadow: "var(--shadow-low)" }}>
      <div className="flex items-center justify-between px-4 sm:px-6 h-[52px]">
        {/* Left: mobile menu + title */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onMobileMenuToggle}
          >
            <Icon icon={Menu} size={20} />
          </Button>
          <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        </div>

        {/* Right: notifications + user */}
        <div className="flex items-center gap-2">
          {/* Notifications Bell */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Icon icon={Bell} size={20} />
                {totalUnread > 0 && (
                  <span className="absolute top-1 right-1 min-w-[16px] h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-0.5">
                    {totalUnread > 99 ? "99+" : totalUnread}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel className="flex items-center justify-between">
                <span>Notifications</span>
                {totalUnread > 0 && (
                  <span className="text-xs font-normal text-muted-foreground">
                    {totalUnread} unread
                  </span>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notifications.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No new notifications
                </div>
              ) : (
                notifications.map((notif) => {
                  const isMsg = notif.type === "message";
                  return (
                    <DropdownMenuItem
                      key={notif.id}
                      className="flex items-start gap-3 px-4 py-3 cursor-pointer"
                      onClick={async () => {
                        if (isMsg && notif.jobId) {
                          await markJobRead(notif.jobId);
                          navigate(`/job/${notif.jobId}`);
                        } else if (!isMsg) {
                          await clearActivityNotification(notif.id);
                          if (notif.jobId) navigate(`/job/${notif.jobId}`);
                        }
                      }}
                    >
                      {/* Icon */}
                      <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isMsg ? "bg-blue-100" : "bg-muted/40"
                      }`}>
                        {isMsg
                          ? <Icon icon={MessageSquare} size={16} className="text-blue-500" />
                          : <span className="text-base leading-none">{getActivityIcon(notif.entryType ?? "")}</span>
                        }
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium truncate text-foreground">{notif.fromName}</p>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0">
                            {timeAgo(notif.timestamp)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{notif.text}</p>
                        {isMsg && (notif.messageCount ?? 0) > 1 && (
                          <span className="inline-flex items-center mt-0.5 px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 text-[10px] font-semibold">
                            {notif.messageCount} new
                          </span>
                        )}
                      </div>
                    </DropdownMenuItem>
                  );
                })
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 px-2">
                <Avatar className="w-7 h-7">
                  <AvatarFallback className="bg-blue-100 text-blue-700 text-xs font-semibold">
                    {user ? getInitials(user.name) : "?"}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden sm:block text-sm font-medium max-w-[120px] truncate">
                  {user?.name}
                </span>
                <Icon icon={ChevronDown} size={16} className="text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>
                <div>
                  <p className="font-medium truncate">{user?.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  <p className="text-xs text-blue-400 capitalize mt-0.5">{user?.role}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <a href="/settings" className="flex items-center gap-2 cursor-pointer">
                  <Icon icon={User} size={16} />
                  Profile & Settings
                </a>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="flex items-center gap-2 text-destructive focus:text-destructive cursor-pointer"
              >
                <Icon icon={LogOut} size={16} />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
