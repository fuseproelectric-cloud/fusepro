import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { getHomeRoute, type UserRole } from "@/lib/routeConfig";

/**
 * Shown when an authenticated user navigates to a route their role
 * cannot access. Rendered inside AppLayout so the sidebar remains visible.
 */
export function ForbiddenPage() {
  const { user } = useAuth();
  const homeRoute = user ? getHomeRoute(user.role as UserRole) : "/login";

  return (
    <div className="flex items-center justify-center py-24 px-6">
      <div className="max-w-sm text-center space-y-4">
        <p className="text-6xl font-bold text-muted-foreground/20 select-none">403</p>
        <h1 className="text-lg font-semibold text-foreground">Access Restricted</h1>
        <p className="text-sm text-muted-foreground">
          You don't have permission to view this page.
        </p>
        <Link
          href={homeRoute}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-500 hover:text-blue-700 transition-colors"
        >
          ← Go back home
        </Link>
      </div>
    </div>
  );
}
