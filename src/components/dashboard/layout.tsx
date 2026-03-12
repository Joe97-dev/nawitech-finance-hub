
import { PropsWithChildren } from "react";
import { AppSidebar } from "./sidebar";
import { AppHeader } from "./header";
import { SidebarProvider } from "@/components/ui/sidebar";

export const DashboardLayout = ({ children }: PropsWithChildren) => {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full overflow-hidden">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col min-w-0">
          <AppHeader />
          <main className="flex-1 p-3 sm:p-6 overflow-auto">
            {children}
          </main>
          <footer className="border-t p-3 sm:p-4 text-center text-xs sm:text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Superdon Microfinance. All rights reserved.
          </footer>
        </div>
      </div>
    </SidebarProvider>
  );
};
