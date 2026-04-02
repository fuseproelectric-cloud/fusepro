import type { ComponentType } from "react";
import { Redirect } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import { ForbiddenPage } from "./ForbiddenPage";
import type { UserRole } from "@/lib/routeConfig";

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
 * - Allowed        → AppLayout + page component
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
      <Component />
    </AppLayout>
  );
}
