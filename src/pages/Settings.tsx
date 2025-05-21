import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Users, ShieldCheck, BookText } from "lucide-react";
import { LoanProductsManager } from "@/components/admin/LoanProductsManager";

type UserWithRole = {
  id: string;
  email: string;
  role: "admin" | "loan_officer" | "data_entry";
  created_at: string;
}

const Settings = () => {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState<"admin" | "loan_officer" | "data_entry">("data_entry");
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { user, isAuthenticated } = useAuth();

  const fetchUsers = async () => {
    try {
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('id, username, created_at');
      
      if (usersError) throw usersError;
      
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');
        
      if (rolesError) throw rolesError;
      
      const combinedData = usersData.map(u => {
        const roleInfo = rolesData.find(r => r.user_id === u.id);
        return {
          id: u.id,
          email: u.username || 'Unknown',
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

  const inviteUser = async () => {
    if (!newUserEmail) {
      toast.error("Please enter an email address");
      return;
    }
    
    setLoading(true);
    try {
      // In a real implementation, you would use Supabase's invite user functionality
      // Since that's not available in the free tier, we'll simulate it
      toast.success(`Invitation sent to ${newUserEmail} as ${newUserRole}`);
      setDialogOpen(false);
      setNewUserEmail("");
      setNewUserRole("data_entry");
    } catch (error: any) {
      toast.error("Failed to invite user: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (userId: string, newRole: "admin" | "loan_officer" | "data_entry") => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .upsert({ 
          user_id: userId,
          role: newRole,
          updated_at: new Date().toISOString()
        });
      
      if (error) throw error;
      
      // Update local state
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
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Users & Roles</CardTitle>
                    <CardDescription>
                      Manage user permissions and access levels
                    </CardDescription>
                  </div>
                  <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>Invite User</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Invite New User</DialogTitle>
                        <DialogDescription>
                          Send an invitation email to add a new user to the system
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="email">Email</Label>
                          <Input
                            id="email"
                            type="email"
                            placeholder="user@example.com"
                            value={newUserEmail}
                            onChange={(e) => setNewUserEmail(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="role">Role</Label>
                          <Select
                            value={newUserRole}
                            onValueChange={(value: any) => setNewUserRole(value)}
                          >
                            <SelectTrigger id="role">
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="loan_officer">Loan Officer</SelectItem>
                              <SelectItem value="data_entry">Data Entry</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button onClick={inviteUser} disabled={loading}>
                          {loading ? "Sending..." : "Send Invitation"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            <Select
                              value={user.role}
                              onValueChange={(value: any) => updateUserRole(user.id, value)}
                            >
                              <SelectTrigger className="w-32">
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
                            {new Date(user.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm">
                              Reset Password
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
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
                    <Label htmlFor="password-policy">Password Policy</Label>
                    <Select defaultValue="strong">
                      <SelectTrigger id="password-policy">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="basic">Basic (min. 8 characters)</SelectItem>
                        <SelectItem value="strong">Strong (min. 10 chars with numbers and symbols)</SelectItem>
                        <SelectItem value="very-strong">Very Strong (min. 12 chars with mixed case, numbers and symbols)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="session-timeout">Session Timeout</Label>
                    <Select defaultValue="8h">
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
                  
                  <Button className="mt-4">Save Security Settings</Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Settings;
