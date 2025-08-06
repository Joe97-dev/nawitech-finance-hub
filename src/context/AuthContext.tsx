
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type AuthContextType = {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
  approvalStatus: 'pending' | 'approved' | 'rejected' | 'deactivated' | null;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [approvalStatus, setApprovalStatus] = useState<'pending' | 'approved' | 'rejected' | 'deactivated' | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Get initial session first
    const initializeAuth = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        
        if (currentSession) {
          setSession(currentSession);
          setUser(currentSession.user);
          
          // Check approval status
          await checkApprovalStatus(currentSession.user.id);
        }
        
        // Mark auth initialization as complete only here
        setLoading(false);
      } catch (error) {
        console.error("Error checking auth session:", error);
        setLoading(false);
      }
    };

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        console.log("Auth state changed:", event, "user:", currentSession?.user?.email);
        
        // Only update state, don't navigate here
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        
        if (currentSession?.user) {
          // Use setTimeout to prevent blocking the auth state change
          setTimeout(() => {
            checkApprovalStatus(currentSession.user.id);
          }, 0);
        } else {
          setApprovalStatus(null);
        }
      }
    );

    // Initialize auth state
    initializeAuth();
    
    // Cleanup subscription
    return () => subscription.unsubscribe();
  }, []);

  const checkApprovalStatus = async (userId: string) => {
    try {
      console.log("Checking approval status for user:", userId);
      const { data, error } = await supabase
        .from('user_approvals')
        .select('status')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error checking approval status:', error);
        setApprovalStatus('pending'); // Default to pending if error
        return;
      }

      const status = data?.status || 'pending';
      console.log("Approval status:", status);
      setApprovalStatus(status);
    } catch (error) {
      console.error('Error checking approval status:', error);
      setApprovalStatus('pending');
    }
  };

  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      const { error, data } = await supabase.auth.signInWithPassword({ email, password });
      
      if (error) {
        throw error;
      }

      // If login successful, session will be updated by the auth listener
      toast.success("Login successful");
    } catch (error: any) {
      toast.error(error.message || "Failed to login");
      console.error("Login error:", error);
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      setLoading(true);
      
      const redirectUrl = `${window.location.origin}/`;
      
      const { error, data } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          emailRedirectTo: redirectUrl
        }
      });
      
      if (error) {
        throw error;
      }

      // If the user is immediately confirmed (email confirmation disabled)
      if (data.user && !data.user.email_confirmed_at) {
        toast.success("Sign up successful! Please check your email to verify your account.");
      } else if (data.user) {
        toast.success("Account created successfully! Pending admin approval.");
      }
      
    } catch (error: any) {
      toast.error(error.message || "Failed to sign up");
      console.error("Signup error:", error);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      await supabase.auth.signOut();
      toast.success("Logged out successfully");
      // Use navigate here to ensure we only redirect once after logout
      navigate("/login", { replace: true });
    } catch (error: any) {
      toast.error(error.message || "Failed to logout");
      console.error("Logout error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      isAuthenticated: !!user, 
      login, 
      signUp, 
      logout, 
      loading,
      approvalStatus
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
