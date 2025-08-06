import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Clock, User, UserX } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface UserApproval {
  id: string;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'deactivated';
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  created_at: string;
  email?: string; // Add email field
  profiles?: {
    username?: string;
  } | null;
}

const UserApprovals = () => {
  const [approvals, setApprovals] = useState<UserApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectionReason, setRejectionReason] = useState("");
  const [deactivationReason, setDeactivationReason] = useState("");
  const [selectedRole, setSelectedRole] = useState<"admin" | "loan_officer" | "data_entry">("data_entry");
  const [approvingUserId, setApprovingUserId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchApprovals = async () => {
    try {
      // Fetch user approvals
      const { data: approvalsData, error: approvalsError } = await supabase
        .from('user_approvals')
        .select('*')
        .order('created_at', { ascending: false });

      if (approvalsError) throw approvalsError;

      // Fetch profiles for usernames
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username');

      if (profilesError) throw profilesError;

      // Get emails for users who don't have profiles yet (pending users)
      const approvalsWithEmails = await Promise.all(
        (approvalsData || []).map(async (approval) => {
          const profile = profilesData?.find(p => p.id === approval.user_id);
          
          // If no profile exists, get email from auth.users via RPC
          if (!profile) {
            try {
              const { data: email } = await supabase.rpc('get_user_email', {
                user_id_input: approval.user_id
              });
              return {
                ...approval,
                email,
                profiles: null
              };
            } catch (error) {
              console.error('Error fetching email for user:', approval.user_id, error);
              return {
                ...approval,
                email: null,
                profiles: null
              };
            }
          }
          
          return {
            ...approval,
            profiles: { username: profile.username }
          };
        })
      );

      setApprovals(approvalsWithEmails);
    } catch (error) {
      console.error('Error fetching approvals:', error);
      toast({
        title: "Error",
        description: "Failed to fetch user approvals",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId: string, role: "admin" | "loan_officer" | "data_entry" = "data_entry") => {
    try {
      const { error } = await supabase.rpc('approve_user', {
        target_user_id: userId,
        assigned_role: role
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `User approved successfully with ${role.replace('_', ' ')} role`,
      });

      setApprovingUserId(null);
      setSelectedRole("data_entry");
      await fetchApprovals();
    } catch (error) {
      console.error('Error approving user:', error);
      toast({
        title: "Error",
        description: "Failed to approve user",
        variant: "destructive",
      });
    }
  };

  const handleReject = async (userId: string) => {
    try {
      const { error } = await supabase.rpc('reject_user', {
        target_user_id: userId,
        reason: rejectionReason || null
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "User rejected successfully",
      });

      setRejectionReason("");
      await fetchApprovals();
    } catch (error) {
      console.error('Error rejecting user:', error);
      toast({
        title: "Error",
        description: "Failed to reject user",
        variant: "destructive",
      });
    }
  };

  const handleDeactivate = async (userId: string) => {
    try {
      const { error } = await supabase.rpc('deactivate_user', {
        target_user_id: userId,
        reason: deactivationReason || null
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "User access has been removed successfully",
      });

      setDeactivationReason("");
      await fetchApprovals();
    } catch (error) {
      console.error('Error deactivating user:', error);
      toast({
        title: "Error",
        description: "Failed to remove user access",
        variant: "destructive",
      });
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'admin': return 'Admin';
      case 'loan_officer': return 'Loan Officer';
      case 'data_entry': return 'Data Entry';
      default: return role;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Pending</Badge>;
      case 'approved':
        return <Badge variant="default" className="gap-1 bg-green-500"><CheckCircle className="h-3 w-3" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Rejected</Badge>;
      case 'deactivated':
        return <Badge variant="destructive" className="gap-1"><UserX className="h-3 w-3" />Deactivated</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, []);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      </DashboardLayout>
    );
  }

  const pendingApprovals = approvals.filter(a => a.status === 'pending');
  const processedApprovals = approvals.filter(a => a.status !== 'pending');

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Approvals</h1>
          <p className="text-muted-foreground">Manage user registration approvals</p>
        </div>

        {/* Pending Approvals */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Pending Approvals ({pendingApprovals.length})
            </CardTitle>
            <CardDescription>
              Users waiting for approval to access the system
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pendingApprovals.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No pending approvals</p>
            ) : (
              <div className="space-y-4">
                {pendingApprovals.map((approval) => (
                  <div key={approval.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                        <User className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium">
                          {approval.profiles?.username || approval.email || `User ${approval.user_id.slice(0, 8)}`}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Registered: {new Date(approval.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(approval.status)}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            onClick={() => setApprovingUserId(approval.user_id)}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Approve User Registration</AlertDialogTitle>
                            <AlertDialogDescription>
                              Select the role for this user and approve their registration.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <div className="py-4">
                            <Label htmlFor="role-select">Assign Role</Label>
                            <Select value={selectedRole} onValueChange={(value) => setSelectedRole(value as "admin" | "loan_officer" | "data_entry")}>
                              <SelectTrigger className="mt-2">
                                <SelectValue placeholder="Select a role" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="data_entry">Data Entry</SelectItem>
                                <SelectItem value="loan_officer">Loan Officer</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => {
                              setApprovingUserId(null);
                              setSelectedRole("data_entry");
                            }}>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleApprove(approval.user_id, selectedRole)}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              Approve with {getRoleDisplayName(selectedRole)} Role
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="destructive"
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Reject User Registration</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to reject this user's registration? You can optionally provide a reason.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <div className="py-4">
                            <Textarea
                              placeholder="Reason for rejection (optional)"
                              value={rejectionReason}
                              onChange={(e) => setRejectionReason(e.target.value)}
                              className="min-h-[100px]"
                            />
                          </div>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleReject(approval.user_id)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Reject User
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Processed Approvals */}
        <Card>
          <CardHeader>
            <CardTitle>Approval History</CardTitle>
            <CardDescription>
              Previously processed user registrations
            </CardDescription>
          </CardHeader>
          <CardContent>
            {processedApprovals.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No processed approvals</p>
            ) : (
              <div className="space-y-4">
                {processedApprovals.map((approval) => (
                  <div key={approval.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                        <User className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium">
                          {approval.profiles?.username || approval.email || `User ${approval.user_id.slice(0, 8)}`}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Processed: {approval.approved_at ? new Date(approval.approved_at).toLocaleDateString() : 'N/A'}
                        </p>
                        {approval.rejection_reason && (
                          <p className="text-sm text-red-600 mt-1">
                            Reason: {approval.rejection_reason}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(approval.status)}
                      {approval.status === 'approved' && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="destructive"
                            >
                              <UserX className="h-4 w-4 mr-1" />
                              Remove Access
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove User Access</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to remove this user's access to the system? This will revoke all their permissions and they will no longer be able to log in. You can optionally provide a reason.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <div className="py-4">
                              <Textarea
                                placeholder="Reason for removing access (optional)"
                                value={deactivationReason}
                                onChange={(e) => setDeactivationReason(e.target.value)}
                                className="min-h-[100px]"
                              />
                            </div>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeactivate(approval.user_id)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Remove Access
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default UserApprovals;