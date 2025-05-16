
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import ClientsIndex from "./pages/clients/Index";
import NewClient from "./pages/clients/New";
import LoansIndex from "./pages/loans/Index";
import NewLoan from "./pages/loans/New";
import ArrearsReport from "./pages/reports/Arrears";
import PARReport from "./pages/reports/PAR";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/clients" element={<ClientsIndex />} />
          <Route path="/clients/new" element={<NewClient />} />
          <Route path="/loans" element={<LoansIndex />} />
          <Route path="/loans/new" element={<NewLoan />} />
          <Route path="/reports/arrears" element={<ArrearsReport />} />
          <Route path="/reports/par" element={<PARReport />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
