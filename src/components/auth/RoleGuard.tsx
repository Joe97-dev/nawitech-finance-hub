
import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useRole } from "@/context/RoleContext";

type UserRole = "admin" | "loan_officer" | "data_entry";

interface RoleGuardProps {
  children: ReactNode;
  allowedRoles: UserRole[];
  fallback?: ReactNode;
}

export const RoleGuard = ({
  children,
  allowedRoles,
  fallback = <Navigate to="/" replace />
}: RoleGuardProps) => {
  const { hasPermission, loading } = useRole();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  // Check if user has permission
  if (!hasPermission(allowedRoles)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
