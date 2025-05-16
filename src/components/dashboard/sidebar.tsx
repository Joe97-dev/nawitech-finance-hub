
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  FileText,
  PieChart,
  Settings,
  BarChartHorizontal,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

const mainNavItems = [
  {
    title: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Clients",
    href: "/clients",
    icon: Users,
  },
  {
    title: "Loans",
    href: "/loans",
    icon: CreditCard,
  }
];

const reportNavItems = [
  {
    title: "Arrears Report",
    href: "/reports/arrears",
    icon: FileText,
  },
  {
    title: "Repayment Report",
    href: "/reports/repayment",
    icon: FileText,
  },
  {
    title: "KYC Report",
    href: "/reports/kyc",
    icon: FileText,
  },
  {
    title: "Portfolio Performance",
    href: "/reports/portfolio",
    icon: BarChartHorizontal,
  },
  {
    title: "Disbursal Report",
    href: "/reports/disbursal",
    icon: FileText,
  },
  {
    title: "Forecasting Report",
    href: "/reports/forecasting",
    icon: FileText,
  },
  {
    title: "PAR Report",
    href: "/reports/par",
    icon: PieChart,
  },
  {
    title: "Collection Rate",
    href: "/reports/collection",
    icon: PieChart,
  }
];

export function AppSidebar() {
  const { collapsed } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;

  const isActive = (path: string) => {
    if (path === "/") {
      return currentPath === path;
    }
    return currentPath.startsWith(path);
  };

  const getNavClass = ({ isActive }: { isActive: boolean }) => {
    return `flex items-center gap-2 py-2 px-3 rounded-md ${
      isActive
        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
        : "text-sidebar-foreground hover:bg-sidebar-accent/50"
    }`;
  };

  const isMainExpanded = mainNavItems.some((item) => isActive(item.href));
  const isReportsExpanded = reportNavItems.some((item) => isActive(item.href));

  return (
    <Sidebar
      className={`border-r ${collapsed ? "w-14" : "w-64"} transition-all duration-200`}
      collapsible
    >
      <div className={`flex h-16 items-center justify-center border-b ${!collapsed ? "px-6" : ""}`}>
        {collapsed ? (
          <span className="text-xl font-bold text-nawitech-600">N</span>
        ) : (
          <span className="text-xl font-bold text-nawitech-600">Nawitech</span>
        )}
      </div>
      <SidebarContent className="p-2">
        <SidebarGroup
          defaultOpen={isMainExpanded}
        >
          <SidebarGroupLabel className={collapsed ? "sr-only" : ""}>
            Main
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.href}
                      className={getNavClass}
                      end={item.href === "/"}
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup defaultOpen={isReportsExpanded}>
          <SidebarGroupLabel className={collapsed ? "sr-only" : ""}>
            Reports
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {reportNavItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.href} className={getNavClass}>
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className={collapsed ? "sr-only" : ""}>
            Settings
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/settings" className={getNavClass}>
                    <Settings className="h-4 w-4" />
                    {!collapsed && <span>Settings</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <div className="mt-auto p-2">
        <SidebarTrigger className="w-full flex justify-center p-2 hover:bg-sidebar-accent/50 rounded-md" />
      </div>
    </Sidebar>
  );
}
