import { useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Dashboard from "./pages/Dashboard";
import CampaignPage from "./pages/Campaign";
import HistoryPage from "./pages/History";
import CampaignDetail from "./pages/CampaignDetail";
import ProspectsPage from "./pages/Prospects";
import SentEmailsPage from "./pages/SentEmails";
import AdminAnalyticsPage from "./pages/AdminAnalytics";
import LandingPage from "./pages/LandingPage";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";
import { Sidebar } from "./components/Sidebar";
import { NavBar } from "./components/NavBar";

const queryClient = new QueryClient();

// Main app layout component (requires authentication)
const AppLayout = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { isAuthenticated } = useAuth();

  // If not authenticated, redirect to welcome page
  if (!isAuthenticated) {
    return <Navigate to="/welcome" replace />;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
      <div 
        className="flex-1 flex flex-col transition-all duration-300" 
        style={{ marginLeft: sidebarCollapsed ? '64px' : '256px' }}
      >
        <NavBar collapsed={sidebarCollapsed} />
        <main className="flex-1 overflow-auto mt-16">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route 
              path="/campaign" 
              element={
                <ProtectedRoute allowedRoles={["admin", "user"]}>
                  <CampaignPage />
                </ProtectedRoute>
              } 
            />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/history/:id" element={<CampaignDetail />} />
            <Route path="/prospects" element={<ProspectsPage />} />
            <Route 
              path="/sent-emails" 
              element={
                <ProtectedRoute allowedRoles={["admin", "user"]}>
                  <SentEmailsPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/analytics" 
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminAnalyticsPage />
                </ProtectedRoute>
              } 
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Public route */}
              <Route path="/welcome" element={<LandingPage />} />
              
              {/* Protected routes */}
              <Route path="/*" element={<AppLayout />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
