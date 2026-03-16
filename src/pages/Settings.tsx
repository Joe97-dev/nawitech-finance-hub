import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getSessionTimeoutMinutes, setSessionTimeoutMinutes } from "@/hooks/use-session-timeout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader,
  TableRow 
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { useRole } from "@/context/RoleContext";
import { supabase } from "@/integrations/supabase/client";
import { getOrganizationId } from "@/lib/get-organization-id";
import { toast } from "sonner";
import { Users, ShieldCheck, BookText } from "lucide-react";
import { LoanProductsManager } from "@/components/admin/LoanProductsManager";
import { AdminPasswordReset } from "@/components/admin/AdminPasswordReset";

type UserWithRole = {
  id: string;
  email: string;
  role: "admin" | "loan_officer" | "data_entry";
  created_at: string;
}

const Settings = () => {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [sessionTimeout, setSessionTimeout] = useState(() => {
    const mins = getSessionTimeoutMinutes();
    if (mins <= 60) return "1h";
    if (mins <= 240) return "4h";
    if (mins <= 480) return "8h";
    return "24h";
  });
  const { user: authUser, isAuthenticated } = useAuth();
  const { isAdmin, hasPermission } = useRole();

  const fetchUsers = async () => {
    try {
      const organizationId = await getOrganizationId();

      const [{ data: usersData, error: usersError }, { data: rolesData, error: rolesError }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, username, first_name, last_name, created_at')
          .eq('organization_id', organizationId),
        supabase
          .from('user_roles')
          .select('user_id, role'),
      ]);
      
      if (usersError) throw usersError;
      if (rolesError) throw rolesError;
      
      const combinedData = (usersData || []).map(u => {
        const roleInfo = rolesData?.find(r => r.user_id === u.id);
        const displayName = [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.username || 'Unknown';
        return {
          id: u.id,
          email: displayName,
          created_at: u.created_at,
          role: roleInfo?.role || "data_entry"
        };
      });
      
      setUsers(combinedData);
    } catch (error: any) {
      toast.error("Failed to fetch users: " + error.message);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchUsers();
    }
  }, [isAuthenticated]);

  const updateUserRole = async (userId: string, newRole: "admin" | "loan_officer" | "data_entry") => {
    if (!isAdmin) {
      toast.error("Access denied: Only administrators can change user roles");
      return;
    }

    if (userId === authUser?.id) {
      toast.error("Security restriction: You cannot modify your own role");
      return;
    }

    try {
      // Use update targeting the specific user's role row
      const { data: existing } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('user_roles')
          .update({ role: newRole, updated_at: new Date().toISOString() })
          .eq('user_id', userId);
        if (error) throw error;
      } else {
        const organizationId = await getOrganizationId();
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role: newRole, organization_id: organizationId });
        if (error) throw error;
      }
      
      setUsers(users.map(u => u.id === userId ? {...u, role: newRole} : u));
      toast.success("User role updated successfully");
    } catch (error: any) {
      toast.error("Failed to update role: " + error.message);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex-col">
        <div className="flex-1 space-y-4 p-4 md:p-8">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
          </div>
          
          <Tabs defaultValue="users" className="space-y-4">
            <TabsList>
              <TabsTrigger value="users" className="flex items-center">
                <Users className="mr-2 h-4 w-4" />
                Users & Roles
              </TabsTrigger>
              <TabsTrigger value="loanProducts" className="flex items-center">
                <BookText className="mr-2 h-4 w-4" />
                Loan Products
              </TabsTrigger>
              <TabsTrigger value="security" className="flex items-center">
                <ShieldCheck className="mr-2 h-4 w-4" />
                Security
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="users" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Users & Roles</CardTitle>
                  <CardDescription>
                    Manage user permissions and access levels. New users register via the sign-up page and are approved in User Approvals.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Joined</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((staffUser) => {
                        const isSelf = staffUser.id === authUser?.id;
                        return (
                          <TableRow key={staffUser.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {staffUser.email}
                                {isSelf && (
                                  <span className="text-xs text-muted-foreground">(you)</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={staffUser.role}
                                onValueChange={(value: any) => updateUserRole(staffUser.id, value)}
                                disabled={!isAdmin || isSelf}
                              >
                                <SelectTrigger className="w-36">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="admin">Admin</SelectItem>
                                  <SelectItem value="loan_officer">Loan Officer</SelectItem>
                                  <SelectItem value="data_entry">Data Entry</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              {staffUser.created_at ? new Date(staffUser.created_at).toLocaleDateString() : '—'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="loanProducts" className="space-y-4">
              <LoanProductsManager />
            </TabsContent>

            <TabsContent value="security" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Security Settings</CardTitle>
                  <CardDescription>
                    Configure security settings for your organization
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="session-timeout">Session Timeout (auto-logout after inactivity)</Label>
                    <Select 
                      value={sessionTimeout} 
                      onValueChange={(value) => {
                        setSessionTimeout(value);
                        const minutesMap: Record<string, number> = { "1h": 60, "4h": 240, "8h": 480, "24h": 1440 };
                        setSessionTimeoutMinutes(minutesMap[value] || 480);
                        toast.success(`Session timeout updated to ${value.replace("h", " hour(s)")}`);
                      }}
                    >
                      <SelectTrigger id="session-timeout">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1h">1 hour</SelectItem>
                        <SelectItem value="4h">4 hours</SelectItem>
                        <SelectItem value="8h">8 hours</SelectItem>
                        <SelectItem value="24h">24 hours</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              <AdminPasswordReset users={users} isAdmin={isAdmin} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Settings;
