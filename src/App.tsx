
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import { useSessionTimeout } from "./hooks/use-session-timeout";
import Index from "./pages/Index";
import Login from "./pages/Login";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { RoleGuard } from "./components/auth/RoleGuard";
import { AuthProvider } from "./context/AuthContext";
import { RoleProvider } from "./context/RoleContext";
import { Toaster } from "./components/ui/toaster";

// Lazy load all heavy pages
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Settings = lazy(() => import("./pages/Settings"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PendingApproval = lazy(() => import("./pages/PendingApproval"));
const Rejected = lazy(() => import("./pages/Rejected"));
const UserApprovals = lazy(() => import("./pages/admin/UserApprovals"));
const DataMigration = lazy(() => import("./pages/admin/DataMigration"));
const ClientsIndex = lazy(() => import("./pages/clients/Index"));
const ClientNew = lazy(() => import("./pages/clients/New"));
const ClientDetail = lazy(() => import("./pages/clients/Detail"));
const LoansIndex = lazy(() => import("./pages/loans/Index"));
const LoanNew = lazy(() => import("./pages/loans/New"));
const LoanDetail = lazy(() => import("./pages/loans/Detail"));
const BranchesIndex = lazy(() => import("./pages/branches/Index"));
const BranchDetail = lazy(() => import("./pages/branches/Detail"));
const PARReport = lazy(() => import("./pages/reports/PAR"));
const CashFlowReport = lazy(() => import("./pages/reports/CashFlow"));
const CollectionReport = lazy(() => import("./pages/reports/Collection"));
const DisbursalReport = lazy(() => import("./pages/reports/Disbursal"));
const LoansDueReport = lazy(() => import("./pages/reports/LoansDue"));
const LoanPerformanceReport = lazy(() => import("./pages/reports/LoanPerformance"));
const KYCReport = lazy(() => import("./pages/reports/KYC"));
const IncomeReport = lazy(() => import("./pages/reports/Income"));
const ArrearsReport = lazy(() => import("./pages/reports/Arrears"));
const DormantReport = lazy(() => import("./pages/reports/Dormant"));
const ForecastingReport = lazy(() => import("./pages/reports/Forecasting"));
const TransactionsReport = lazy(() => import("./pages/reports/Transactions"));

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
  </div>
);

function SessionTimeoutWrapper({ children }: { children: React.ReactNode }) {
  useSessionTimeout();
  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <RoleProvider>
          <SessionTimeoutWrapper>
          <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/pending-approval" element={<PendingApproval />} />
            <Route path="/rejected" element={<Rejected />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            
            {/* Admin Routes */}
            <Route path="/admin/user-approvals" element={<ProtectedRoute><UserApprovals /></ProtectedRoute>} />
            <Route path="/admin/data-migration" element={<ProtectedRoute><DataMigration /></ProtectedRoute>} />

            {/* Clients */}
            <Route path="/clients" element={<ProtectedRoute><ClientsIndex /></ProtectedRoute>} />
            <Route path="/clients/new" element={<ProtectedRoute><ClientNew /></ProtectedRoute>} />
            <Route path="/clients/:clientId" element={<ProtectedRoute><ClientDetail /></ProtectedRoute>} />
            
            {/* Loans */}
            <Route path="/loans" element={<ProtectedRoute><LoansIndex /></ProtectedRoute>} />
            <Route path="/loans/new" element={<ProtectedRoute><RoleGuard allowedRoles={["admin"]}><LoanNew /></RoleGuard></ProtectedRoute>} />
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
            <Route path="/reports/transactions" element={<ProtectedRoute><TransactionsReport /></ProtectedRoute>} />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
          <Toaster />
          </SessionTimeoutWrapper>
        </RoleProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
