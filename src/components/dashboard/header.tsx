
import { Button } from "@/components/ui/button";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { useAuth } from "@/context/AuthContext";
import { LogOut, User } from "lucide-react";

export function AppHeader() {
  const { state } = useSidebar();
  
  // Use try/catch to safely access the auth context
  try {
    const { user, logout } = useAuth();
    
    // Get the email to display instead of username
    const displayName = user?.email || 'User';
    
    return (
      <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background px-4 sm:px-6">
        <SidebarTrigger />
        <div className="flex-1">
          <h1 className="text-lg font-semibold">Nawitech Microfinance</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
              <User className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="hidden md:block">
              <p className="text-sm font-medium">{displayName}</p>
              <p className="text-xs text-muted-foreground">Admin</p>
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
          <h1 className="text-lg font-semibold">Nawitech Microfinance</h1>
        </div>
      </header>
    );
  }
}
