import { Suspense, type ComponentType } from "react";
import { Redirect } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import { ForbiddenPage } from "./ForbiddenPage";
import type { UserRole } from "@/lib/routeConfig";

/**
 * Skeleton placeholder shown while a lazy page chunk is loading.
 * Renders inside AppLayout so the shell (sidebar + header) stays visible.
 */
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-2">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-muted-foreground">Loading…</p>
      </div>
    </div>
  );
}

interface Props {
  component:    ComponentType;
  /** Roles permitted to view this route. null = any authenticated user. */
  allowedRoles: UserRole[] | null;
}

/**
 * Route guard that enforces both authentication and role-based access.
 *
 * - Unauthenticated → redirect to /login
 * - Wrong role     → ForbiddenPage (inside AppLayout so sidebar stays visible)
 * - Allowed        → AppLayout + lazy page (Suspense-wrapped so shell stays)
 *
 * Loading state is handled upstream in AppRoutes before any Route renders,
 * so isLoading is not checked here.
 */
export function ProtectedRoute({ component: Component, allowedRoles }: Props) {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  if (allowedRoles !== null && user && !allowedRoles.includes(user.role as UserRole)) {
    return (
      <AppLayout>
        <ForbiddenPage />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Suspense fallback={<PageLoader />}>
        <Component />
      </Suspense>
    </AppLayout>
  );
}
