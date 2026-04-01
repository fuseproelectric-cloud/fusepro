import { Switch, Route, Redirect } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import React from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { JobsPage } from "@/pages/JobsPage";
import { SchedulePage } from "@/pages/SchedulePage";
import { TechniciansPage } from "@/pages/TechniciansPage";
import { CustomersPage } from "@/pages/CustomersPage";
import { CustomerDetailPage } from "@/pages/CustomerDetailPage";
import { CustomerAddressPage } from "@/pages/CustomerAddressPage";
import { EstimatesPage } from "@/pages/EstimatesPage";
import { InvoicesPage } from "@/pages/InvoicesPage";
import { InventoryPage } from "@/pages/InventoryPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { MyJobsPage } from "@/pages/MyJobsPage";
import { MySchedulePage } from "@/pages/MySchedulePage";
import { JobDetailPage } from "@/pages/JobDetailPage";
import { TimesheetPage } from "@/pages/TimesheetPage";
import { AdminTimesheetPage } from "@/pages/AdminTimesheetPage";
import { ChatPage } from "@/pages/ChatPage";
import { DocsPage } from "@/pages/DocsPage";
import { RequestsPage } from "@/pages/RequestsPage";
import { ServicesPage } from "@/pages/ServicesPage";
import { ConnecteamPage } from "@/pages/ConnecteamPage";
import { Toaster } from "@/components/ui/toaster";

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
              className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600"
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
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  return (
    <AppLayout>
      <Component />
    </AppLayout>
  );
}

function AppRoutes() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  // Determine home route based on role
  const homeRedirect = user?.role === "technician" ? "/my-jobs" : "/";

  return (
    <Switch>
      <Route path="/login">
        {isAuthenticated ? <Redirect to={homeRedirect} /> : <LoginPage />}
      </Route>
      {/* Technician-specific routes */}
      <Route path="/my-jobs">
        <ProtectedRoute component={MyJobsPage} />
      </Route>
      <Route path="/my-schedule">
        <ProtectedRoute component={MySchedulePage} />
      </Route>
      <Route path="/timesheet">
        <ProtectedRoute component={TimesheetPage} />
      </Route>
      {/* Job detail (all roles) */}
      <Route path="/job/:id">
        <ProtectedRoute component={JobDetailPage} />
      </Route>
      {/* Admin/dispatcher routes */}
      <Route path="/admin/timesheets">
        <ProtectedRoute component={AdminTimesheetPage} />
      </Route>
      <Route path="/docs">
        <ProtectedRoute component={DocsPage} />
      </Route>
      <Route path="/">
        <ProtectedRoute component={DashboardPage} />
      </Route>
      <Route path="/jobs">
        <ProtectedRoute component={JobsPage} />
      </Route>
      <Route path="/schedule">
        <ProtectedRoute component={SchedulePage} />
      </Route>
      <Route path="/technicians">
        <ProtectedRoute component={TechniciansPage} />
      </Route>
      <Route path="/customers">
        <ProtectedRoute component={CustomersPage} />
      </Route>
      <Route path="/customers/:id/addresses/:addrId">
        <ProtectedRoute component={CustomerAddressPage} />
      </Route>
      <Route path="/customers/:id">
        <ProtectedRoute component={CustomerDetailPage} />
      </Route>
      <Route path="/estimates">
        <ProtectedRoute component={EstimatesPage} />
      </Route>
      <Route path="/invoices">
        <ProtectedRoute component={InvoicesPage} />
      </Route>
      <Route path="/inventory">
        <ProtectedRoute component={InventoryPage} />
      </Route>
      <Route path="/settings">
        <ProtectedRoute component={SettingsPage} />
      </Route>
      <Route path="/chat/:id">
        <ProtectedRoute component={ChatPage} />
      </Route>
      <Route path="/chat">
        <ProtectedRoute component={ChatPage} />
      </Route>
      <Route path="/requests">
        <ProtectedRoute component={RequestsPage} />
      </Route>
      <Route path="/services">
        <ProtectedRoute component={ServicesPage} />
      </Route>
      <Route path="/integrations/connecteam">
        <ProtectedRoute component={ConnecteamPage} />
      </Route>
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
