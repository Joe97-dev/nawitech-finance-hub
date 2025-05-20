
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { RoleProvider } from "@/context/RoleContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import ClientsIndex from "./pages/clients/Index";
import ClientDetail from "./pages/clients/Detail";
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
import KYCReport from "./pages/reports/KYC";
import ForecastingReport from "./pages/reports/Forecasting";
import DisbursalReport from "./pages/reports/Disbursal";
import BranchesIndex from "./pages/branches/Index";
import BranchDetail from "./pages/branches/Detail";
import Settings from "./pages/Settings";
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
          <RoleProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              
              <Route element={<ProtectedRoute />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/clients" element={<ClientsIndex />} />
                <Route path="/clients/new" element={<NewClient />} />
                <Route path="/clients/:clientId" element={<ClientDetail />} />
                <Route path="/loans" element={<LoansIndex />} />
                <Route path="/loans/new" element={<NewLoan />} />
                <Route path="/branches" element={<BranchesIndex />} />
                <Route path="/branches/:branchId" element={<BranchDetail />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/reports/arrears" element={<ArrearsReport />} />
                <Route path="/reports/par" element={<PARReport />} />
                <Route path="/reports/income" element={<IncomeReport />} />
                <Route path="/reports/cash-flow" element={<CashFlowReport />} />
                <Route path="/reports/loan-performance" element={<LoanPerformanceReport />} />
                <Route path="/reports/collection" element={<CollectionRateReport />} />
                <Route path="/reports/loans-due" element={<LoansDueReport />} />
                <Route path="/reports/dormant" element={<DormantClientsReport />} />
                <Route path="/reports/kyc" element={<KYCReport />} />
                <Route path="/reports/forecasting" element={<ForecastingReport />} />
                <Route path="/reports/disbursal" element={<DisbursalReport />} />
              </Route>
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </RoleProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
