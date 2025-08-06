
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useState, useEffect, ReactNode } from "react";

interface ProtectedRouteProps {
  children: ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { isAuthenticated, loading, approvalStatus } = useAuth();
  const location = useLocation();
  const [authChecked, setAuthChecked] = useState(false);
  
  // Only set authChecked after loading is complete
  useEffect(() => {
    if (!loading) {
      setAuthChecked(true);
    }
  }, [loading]);

  // Show loading state while authentication is being checked
  if (loading || !authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    console.log("Not authenticated, redirecting to login");
    // Save the intended location to redirect to after login
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // Redirect to pending approval page if user is not approved
  if (approvalStatus === 'pending') {
    return <Navigate to="/pending-approval" replace />;
  }

  // Redirect to rejection page if user is rejected or deactivated
  if (approvalStatus === 'rejected' || approvalStatus === 'deactivated') {
    return <Navigate to="/rejected" replace />;
  }

  // Only render child routes if authenticated and approved
  console.log("Authenticated and approved, rendering protected route");
  return <>{children}</>;
};
