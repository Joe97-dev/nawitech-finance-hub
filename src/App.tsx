
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import ClientsIndex from "./pages/clients/Index";
import NewClient from "./pages/clients/New";
import LoansIndex from "./pages/loans/Index";
import NewLoan from "./pages/loans/New";
import ArrearsReport from "./pages/reports/Arrears";
import PARReport from "./pages/reports/PAR";
import IncomeReport from "./pages/reports/Income";
import CashFlowReport from "./pages/reports/CashFlow";
import LoanPerformanceReport from "./pages/reports/LoanPerformance";
import CollectionRateReport from "./pages/reports/Collection";
import LoansDueReport from "./pages/reports/LoansDue";
import DormantClientsReport from "./pages/reports/Dormant";
import BranchesIndex from "./pages/branches/Index";
import BranchDetail from "./pages/branches/Detail";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/clients" element={<ClientsIndex />} />
              <Route path="/clients/new" element={<NewClient />} />
              <Route path="/loans" element={<LoansIndex />} />
              <Route path="/loans/new" element={<NewLoan />} />
              <Route path="/branches" element={<BranchesIndex />} />
              <Route path="/branches/:branchId" element={<BranchDetail />} />
              <Route path="/reports/arrears" element={<ArrearsReport />} />
              <Route path="/reports/par" element={<PARReport />} />
              <Route path="/reports/income" element={<IncomeReport />} />
              <Route path="/reports/cash-flow" element={<CashFlowReport />} />
              <Route path="/reports/loan-performance" element={<LoanPerformanceReport />} />
              <Route path="/reports/collection" element={<CollectionRateReport />} />
              <Route path="/reports/loans-due" element={<LoansDueReport />} />
              <Route path="/reports/dormant" element={<DormantClientsReport />} />
            </Route>
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
