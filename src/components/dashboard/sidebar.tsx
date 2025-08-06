
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  FileText,
  PieChart,
  Settings,
  BarChartHorizontal,
  CalendarDays,
  Building,
  UserCheck,
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
import { useRole } from "@/context/RoleContext";

const mainNavItems = [
  {
    title: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
    requiredRoles: ["admin", "loan_officer", "data_entry"],
  },
  {
    title: "Branches",
    href: "/branches",
    icon: Building,
    requiredRoles: ["admin", "loan_officer"],
  },
  {
    title: "Clients",
    href: "/clients",
    icon: Users,
    requiredRoles: ["admin", "loan_officer", "data_entry"],
  },
  {
    title: "Loans",
    href: "/loans",
    icon: CreditCard,
    requiredRoles: ["admin", "loan_officer", "data_entry"],
  }
];

const reportNavItems = [
  {
    title: "Income Report",
    href: "/reports/income",
    icon: BarChartHorizontal,
    requiredRoles: ["admin", "loan_officer"],
  },
  {
    title: "Cash Flow",
    href: "/reports/cash-flow",
    icon: BarChartHorizontal,
    requiredRoles: ["admin", "loan_officer"],
  },
  {
    title: "Loan Performance",
    href: "/reports/loan-performance",
    icon: PieChart,
    requiredRoles: ["admin", "loan_officer"],
  },
  {
    title: "Collection Rate",
    href: "/reports/collection",
    icon: CalendarDays,
    requiredRoles: ["admin", "loan_officer"],
  },
  {
    title: "Loans Due",
    href: "/reports/loans-due",
    icon: FileText,
    requiredRoles: ["admin", "loan_officer", "data_entry"],
  },
  {
    title: "Dormant Clients",
    href: "/reports/dormant",
    icon: Users,
    requiredRoles: ["admin", "loan_officer"],
  },
  {
    title: "Arrears Report",
    href: "/reports/arrears",
    icon: FileText,
    requiredRoles: ["admin", "loan_officer"],
  },
  {
    title: "PAR Report",
    href: "/reports/par",
    icon: PieChart,
    requiredRoles: ["admin", "loan_officer"],
  },
  {
    title: "KYC Report",
    href: "/reports/kyc", 
    icon: FileText,
    requiredRoles: ["admin", "loan_officer", "data_entry"],
  },
  {
    title: "Forecasting Report",
    href: "/reports/forecasting",
    icon: FileText,
    requiredRoles: ["admin", "loan_officer"],
  },
  {
    title: "Disbursal Report",
    href: "/reports/disbursal",
    icon: FileText,
    requiredRoles: ["admin", "loan_officer", "data_entry"],
  },
  {
    title: "Transactions Report",
    href: "/reports/transactions",
    icon: BarChartHorizontal,
    requiredRoles: ["admin", "loan_officer", "data_entry"],
  }
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const currentPath = location.pathname;
  const { hasPermission, loading } = useRole();

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

  // Filter items based on user role
  const filteredMainNavItems = mainNavItems.filter(item => 
    hasPermission(item.requiredRoles as any[])
  );
  
  const filteredReportNavItems = reportNavItems.filter(item => 
    hasPermission(item.requiredRoles as any[])
  );

  if (loading) {
    return (
      <Sidebar className={`border-r ${collapsed ? "w-14" : "w-64"} transition-all duration-200`}>
        <div className="flex h-16 items-center justify-center border-b">
          <span className="text-xl font-bold text-superdon-600">S</span>
        </div>
        <div className="flex h-[calc(100vh-64px)] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      </Sidebar>
    );
  }

  return (
    <Sidebar
      className={`border-r ${collapsed ? "w-14" : "w-64"} transition-all duration-200`}
      collapsible="icon"
    >
      <div className={`flex h-16 items-center justify-center border-b ${!collapsed ? "px-6" : ""}`}>
        {collapsed ? (
          <span className="text-xl font-bold text-superdon-600">S</span>
        ) : (
          <span className="text-xl font-bold text-superdon-600">Superdon</span>
        )}
      </div>
      <SidebarContent className="p-2">
        <SidebarGroup>
          <SidebarGroupLabel className={collapsed ? "sr-only" : ""}>
            Main
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredMainNavItems.map((item) => (
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

        {filteredReportNavItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className={collapsed ? "sr-only" : ""}>
              Reports
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredReportNavItems.map((item) => (
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
        )}

        <SidebarGroup>
          <SidebarGroupLabel className={collapsed ? "sr-only" : ""}>
            Administration
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {hasPermission(["admin"]) && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink to="/admin/user-approvals" className={getNavClass}>
                      <UserCheck className="h-4 w-4" />
                      {!collapsed && <span>User Approvals</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
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
