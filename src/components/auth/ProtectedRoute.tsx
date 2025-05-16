
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export const ProtectedRoute = () => {
  const { isAuthenticated, loading } = useAuth();

  // Show loading or placeholder while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 border-4 border-nawitech-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  // Render child routes if authenticated
  return <Outlet />;
};
