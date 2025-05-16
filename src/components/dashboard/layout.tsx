
import { PropsWithChildren, useState } from "react";
import { AppSidebar } from "./sidebar";
import { AppHeader } from "./header";
import { SidebarProvider } from "@/components/ui/sidebar";

export const DashboardLayout = ({ children }: PropsWithChildren) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <SidebarProvider collapsedWidth={56}>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col">
          <AppHeader />
          <main className="flex-1 p-6">
            {children}
          </main>
          <footer className="border-t p-4 text-center text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Nawitech Microfinance. All rights reserved.
          </footer>
        </div>
      </div>
    </SidebarProvider>
  );
};
