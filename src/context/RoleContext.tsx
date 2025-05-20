
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';

type UserRole = 'admin' | 'loan_officer' | 'data_entry';

interface RoleContextType {
  userRole: UserRole | null;
  isAdmin: boolean;
  isLoanOfficer: boolean;
  isDataEntry: boolean;
  hasPermission: (requiredRoles: UserRole[]) => boolean;
  loading: boolean;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export const RoleProvider = ({ children }: { children: ReactNode }) => {
  const { user, isAuthenticated } = useAuth();
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user) {
        setUserRole(null);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.error("Error fetching user role:", error);
          setUserRole('data_entry'); // Default role if not set
        } else {
          setUserRole(data?.role || 'data_entry');
        }
      } catch (error) {
        console.error("Failed to fetch user role:", error);
        setUserRole('data_entry'); // Default role if error
      } finally {
        setLoading(false);
      }
    };

    if (isAuthenticated) {
      fetchUserRole();
    } else {
      setUserRole(null);
      setLoading(false);
    }
  }, [user, isAuthenticated]);

  // Role check helpers
  const isAdmin = userRole === 'admin';
  const isLoanOfficer = userRole === 'loan_officer' || userRole === 'admin'; // Admins have loan officer permissions
  const isDataEntry = userRole === 'data_entry' || isLoanOfficer; // All users have data entry permissions

  // Check if user has any of the required roles
  const hasPermission = (requiredRoles: UserRole[]) => {
    if (!userRole) return false;
    if (userRole === 'admin') return true; // Admin has all permissions
    return requiredRoles.includes(userRole);
  };

  return (
    <RoleContext.Provider value={{
      userRole,
      isAdmin,
      isLoanOfficer,
      isDataEntry,
      hasPermission,
      loading
    }}>
      {children}
    </RoleContext.Provider>
  );
};

export const useRole = () => {
  const context = useContext(RoleContext);
  if (context === undefined) {
    throw new Error("useRole must be used within a RoleProvider");
  }
  return context;
};
