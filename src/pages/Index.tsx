
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

const Index = () => {
  const { isAuthenticated, loading } = useAuth();

  // Show loading state while auth is checking
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="h-8 w-8 border-4 border-nawitech-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Redirect based on authentication status
  return isAuthenticated ? (
    <Navigate to="/dashboard" replace />
  ) : (
    <Navigate to="/login" replace />
  );
};

export default Index;
