import { useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import CampaignPage from "./pages/Campaign";
import HistoryPage from "./pages/History";
import CampaignDetail from "./pages/CampaignDetail";
import ProspectsPage from "./pages/Prospects";
import NotFound from "./pages/NotFound";
import { Sidebar } from "./components/Sidebar";
import { NavBar } from "./components/NavBar";

const queryClient = new QueryClient();

const App = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
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
                  <Route path="/campaign" element={<CampaignPage />} />
                  <Route path="/history" element={<HistoryPage />} />
                  <Route path="/history/:id" element={<CampaignDetail />} />
                  <Route path="/prospects" element={<ProspectsPage />} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </main>
            </div>
          </div>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
