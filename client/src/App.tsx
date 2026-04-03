import { Switch, Route, Redirect } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import React from "react";
import { LoginPage } from "@/pages/LoginPage";
import { Toaster } from "@/components/ui/toaster";
import { ProtectedRoute } from "@/components/routing/ProtectedRoute";
import { APP_ROUTES, getHomeRoute, type UserRole } from "@/lib/routeConfig";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="max-w-md text-center space-y-3">
            <p className="text-lg font-semibold text-foreground">Something went wrong</p>
            <p className="text-sm text-muted-foreground font-mono break-all">{this.state.error.message}</p>
            <button
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              onClick={() => window.location.reload()}
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    </div>
  );
}

function AppRoutes() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  const homeRedirect = user ? getHomeRoute(user.role as UserRole) : "/login";

  return (
    <Switch>
      {/* Login: authenticated users are redirected to their role-appropriate home */}
      <Route path="/login">
        {isAuthenticated ? <Redirect to={homeRedirect} /> : <LoginPage />}
      </Route>

      {/* All protected routes are generated from the centralized route config */}
      {APP_ROUTES.map(({ path, component, allowedRoles }) => (
        <Route key={path} path={path}>
          <ProtectedRoute component={component} allowedRoles={allowedRoles} />
        </Route>
      ))}

      {/* Catch-all: redirect to role-appropriate home (or login if not authenticated) */}
      <Route>
        <Redirect to={homeRedirect} />
      </Route>
    </Switch>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AppRoutes />
        <Toaster />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
