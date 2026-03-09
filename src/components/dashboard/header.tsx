
import { Button } from "@/components/ui/button";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { useAuth } from "@/context/AuthContext";
import { LogOut, User } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function AppHeader() {
  const { state } = useSidebar();
  const [firstName, setFirstName] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');
  
  // Use try/catch to safely access the auth context
  try {
    const { user, logout } = useAuth();
    
    // Fetch user profile and role data
    useEffect(() => {
      const fetchUserData = async () => {
        if (!user?.id) return;
        
        try {
          // Get user profile from profiles table  
          const { data: profileData } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', user.id)
            .single();
          
          // Extract first name from username (email)
          if (profileData?.username) {
            const emailPart = profileData.username.split('@')[0];
            // Capitalize first letter and extract first part if there are dots/numbers
            const firstName = emailPart.split(/[._0-9]/)[0];
            const capitalizedFirstName = firstName.charAt(0).toUpperCase() + firstName.slice(1);
            setFirstName(capitalizedFirstName);
          }
          
          // Get user role
          const { data: roleData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id)
            .single();
          
          if (roleData?.role) {
            // Format role for display
            const formattedRole = roleData.role
              .split('_')
              .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');
            setUserRole(formattedRole);
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          // Fallback to email-based name
          if (user?.email) {
            const emailPart = user.email.split('@')[0];
            const firstName = emailPart.split(/[._0-9]/)[0];
            const capitalizedFirstName = firstName.charAt(0).toUpperCase() + firstName.slice(1);
            setFirstName(capitalizedFirstName);
          }
        }
      };
      
      fetchUserData();
    }, [user?.id, user?.email]);
    
    const displayName = firstName || user?.email || 'User';
    
    return (
      <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background px-4 sm:px-6">
        <SidebarTrigger />
        <div className="flex-1">
          <h1 className="text-lg font-semibold">Superdon Microfinance</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
              <User className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="hidden md:block">
              <p className="text-sm font-medium">{displayName}</p>
              <p className="text-xs text-muted-foreground">{userRole || 'User'}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={logout}>
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>
    );
  } catch (error) {
    // If useAuth throws an error, render a simplified header
    console.error("Auth context not available:", error);
    return (
      <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background px-4 sm:px-6">
        <SidebarTrigger />
        <div className="flex-1">
          <h1 className="text-lg font-semibold">Superdon Microfinance</h1>
        </div>
      </header>
    );
  }
}
