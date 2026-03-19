import { Switch, Route, Router, Redirect } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { useState, useEffect } from "react";

import LandingPage from "@/pages/landing";
import { SignupPage, LoginPage } from "@/pages/auth";
import DashboardPage from "@/pages/dashboard";
import DeckPage from "@/pages/deck";
import StudyPage from "@/pages/study";
import NotFound from "@/pages/not-found";

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  return <>{children}</>;
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }
  
  if (!user) {
    return <Redirect to="/login" />;
  }
  
  return <Component />;
}

function PublicOnlyRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  
  if (isLoading) return null;
  if (user) return <Redirect to="/dashboard" />;
  
  return <Component />;
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={() => <PublicOnlyRoute component={LandingPage} />} />
      <Route path="/signup" component={() => <PublicOnlyRoute component={SignupPage} />} />
      <Route path="/login" component={() => <PublicOnlyRoute component={LoginPage} />} />
      <Route path="/dashboard" component={() => <ProtectedRoute component={DashboardPage} />} />
      <Route path="/deck/:id" component={() => <ProtectedRoute component={DeckPage} />} />
      <Route path="/study" component={() => <ProtectedRoute component={StudyPage} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Router hook={useHashLocation}>
              <AppRouter />
            </Router>
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
