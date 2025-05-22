
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import Settings from "./pages/Settings";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
import { RoleProvider } from "./context/RoleContext";
import { Toaster } from "./components/ui/toaster";
import ClientsIndex from "./pages/clients/Index";
import ClientNew from "./pages/clients/New";
import ClientDetail from "./pages/clients/Detail";
import LoansIndex from "./pages/loans/Index";
import LoanNew from "./pages/loans/New";
import LoanDetail from "./pages/loans/Detail";
import BranchesIndex from "./pages/branches/Index";
import BranchDetail from "./pages/branches/Detail";
import PARReport from "./pages/reports/PAR";
import CashFlowReport from "./pages/reports/CashFlow";
import CollectionReport from "./pages/reports/Collection";
import DisbursalReport from "./pages/reports/Disbursal";
import LoansDueReport from "./pages/reports/LoansDue";
import LoanPerformanceReport from "./pages/reports/LoanPerformance";
import KYCReport from "./pages/reports/KYC";
import IncomeReport from "./pages/reports/Income";
import ArrearsReport from "./pages/reports/Arrears";
import DormantReport from "./pages/reports/Dormant";
import ForecastingReport from "./pages/reports/Forecasting";

function App() {
  return (
    <AuthProvider>
      <RoleProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

            {/* Clients */}
            <Route path="/clients" element={<ProtectedRoute><ClientsIndex /></ProtectedRoute>} />
            <Route path="/clients/new" element={<ProtectedRoute><ClientNew /></ProtectedRoute>} />
            <Route path="/clients/:clientId" element={<ProtectedRoute><ClientDetail /></ProtectedRoute>} />
            
            {/* Loans */}
            <Route path="/loans" element={<ProtectedRoute><LoansIndex /></ProtectedRoute>} />
            <Route path="/loans/new" element={<ProtectedRoute><LoanNew /></ProtectedRoute>} />
            <Route path="/loans/:loanId" element={<ProtectedRoute><LoanDetail /></ProtectedRoute>} />
            
            {/* Branches */}
            <Route path="/branches" element={<ProtectedRoute><BranchesIndex /></ProtectedRoute>} />
            <Route path="/branches/:branchId" element={<ProtectedRoute><BranchDetail /></ProtectedRoute>} />
            
            {/* Reports */}
            <Route path="/reports/par" element={<ProtectedRoute><PARReport /></ProtectedRoute>} />
            <Route path="/reports/cash-flow" element={<ProtectedRoute><CashFlowReport /></ProtectedRoute>} />
            <Route path="/reports/collection" element={<ProtectedRoute><CollectionReport /></ProtectedRoute>} />
            <Route path="/reports/disbursal" element={<ProtectedRoute><DisbursalReport /></ProtectedRoute>} />
            <Route path="/reports/loans-due" element={<ProtectedRoute><LoansDueReport /></ProtectedRoute>} />
            <Route path="/reports/loan-performance" element={<ProtectedRoute><LoanPerformanceReport /></ProtectedRoute>} />
            <Route path="/reports/kyc" element={<ProtectedRoute><KYCReport /></ProtectedRoute>} />
            <Route path="/reports/income" element={<ProtectedRoute><IncomeReport /></ProtectedRoute>} />
            <Route path="/reports/arrears" element={<ProtectedRoute><ArrearsReport /></ProtectedRoute>} />
            <Route path="/reports/dormant" element={<ProtectedRoute><DormantReport /></ProtectedRoute>} />
            <Route path="/reports/forecasting" element={<ProtectedRoute><ForecastingReport /></ProtectedRoute>} />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
          <Toaster />
        </BrowserRouter>
      </RoleProvider>
    </AuthProvider>
  );
}

export default App;
