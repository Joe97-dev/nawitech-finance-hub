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

interface Branch {
  id: string;
  name: string;
}

interface UserApproval {
  id: string;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'deactivated';
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  created_at: string;
  email?: string;
  assigned_role?: string;
  profiles?: {
    username?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  } | null;
}

const UserApprovals = () => {
  const [approvals, setApprovals] = useState<UserApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<Branch[]>([]);
  const { toast } = useToast();

  // Per-dialog isolated state
  const [activeApproveUserId, setActiveApproveUserId] = useState<string | null>(null);
  const [activeApproveRole, setActiveApproveRole] = useState<"admin" | "loan_officer" | "data_entry">("data_entry");
  const [activeApproveBranch, setActiveApproveBranch] = useState("");
  const [activeRejectReason, setActiveRejectReason] = useState("");
  const [activeDeactivateReason, setActiveDeactivateReason] = useState("");

  const resetApproveState = () => {
    setActiveApproveUserId(null);
    setActiveApproveRole("data_entry");
    setActiveApproveBranch("");
  };

  const resetRejectState = () => {
    setActiveRejectReason("");
  };

  const resetDeactivateState = () => {
    setActiveDeactivateReason("");
  };

  const fetchApprovals = async () => {
    try {
      const [
        { data: approvalsData, error: approvalsError },
        { data: profilesData, error: profilesError },
        { data: rolesData, error: rolesError },
      ] = await Promise.all([
        supabase.from('user_approvals').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, username, first_name, last_name'),
        supabase.from('user_roles').select('user_id, role'),
      ]);

      if (approvalsError) throw approvalsError;
      if (profilesError) throw profilesError;
      // rolesError is non-critical, just log
      if (rolesError) console.error('Error fetching roles:', rolesError);

      // Build a map of user_id -> role
      const roleMap = new Map<string, string>();
      (rolesData || []).forEach(r => roleMap.set(r.user_id, r.role));

      const approvalsWithDetails = await Promise.all(
        (approvalsData || []).map(async (approval) => {
          const profile = profilesData?.find(p => p.id === approval.user_id);
          const assigned_role = roleMap.get(approval.user_id) || undefined;

          if (!profile) {
            try {
              const { data: email } = await supabase.rpc('get_user_email', {
                user_id_input: approval.user_id
              });
              return { ...approval, email, profiles: null, assigned_role };
            } catch (error) {
              console.error('Error fetching email for user:', approval.user_id, error);
              return { ...approval, email: null, profiles: null, assigned_role };
            }
          }

          return {
            ...approval,
            assigned_role,
            profiles: {
              username: profile.username,
              first_name: profile.first_name,
              last_name: profile.last_name,
            }
          };
        })
      );

      setApprovals(approvalsWithDetails);
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

  const handleApprove = async (userId: string) => {
    try {
      const rpcParams: any = {
        target_user_id: userId,
        assigned_role: activeApproveRole,
      };
      if (activeApproveBranch) {
        rpcParams.assigned_branch_id = activeApproveBranch;
      }
      const { error } = await supabase.rpc('approve_user', rpcParams);

      if (error) throw error;

      toast({
        title: "Success",
        description: `User approved successfully with ${getRoleDisplayName(activeApproveRole)} role`,
      });

      resetApproveState();
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
        reason: activeRejectReason || null
      });

      if (error) throw error;

      toast({ title: "Success", description: "User rejected successfully" });
      resetRejectState();
      await fetchApprovals();
    } catch (error) {
      console.error('Error rejecting user:', error);
      toast({ title: "Error", description: "Failed to reject user", variant: "destructive" });
    }
  };

  const handleDeactivate = async (userId: string) => {
    try {
      const { error } = await supabase.rpc('deactivate_user', {
        target_user_id: userId,
        reason: activeDeactivateReason || null
      });

      if (error) throw error;

      toast({ title: "Success", description: "User access has been removed successfully" });
      resetDeactivateState();
      await fetchApprovals();
    } catch (error) {
      console.error('Error deactivating user:', error);
      toast({ title: "Error", description: "Failed to remove user access", variant: "destructive" });
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

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">Admin</Badge>;
      case 'loan_officer':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Loan Officer</Badge>;
      case 'data_entry':
        return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Data Entry</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  const getUserDisplayName = (approval: UserApproval) => {
    const fullName = [approval.profiles?.first_name, approval.profiles?.last_name]
      .filter(Boolean)
      .join(' ')
      .trim();

    if (fullName) return fullName;
    if (approval.profiles?.username) return approval.profiles.username;
    if (approval.email) return approval.email;

    return `User ${approval.user_id.slice(0, 8)}`;
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
    const fetchBranches = async () => {
      const { data } = await supabase.from('branches').select('id, name');
      setBranches(data || []);
    };
    fetchBranches();
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
                        <p className="font-medium">{getUserDisplayName(approval)}</p>
                        <p className="text-sm text-muted-foreground">
                          Registered: {new Date(approval.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(approval.status)}

                      {/* Approve Dialog */}
                      <AlertDialog
                        onOpenChange={(open) => {
                          if (open) {
                            setActiveApproveUserId(approval.user_id);
                            setActiveApproveRole("data_entry");
                            setActiveApproveBranch("");
                          } else {
                            resetApproveState();
                          }
                        }}
                      >
                        <AlertDialogTrigger asChild>
                          <Button size="sm" className="bg-green-600 hover:bg-green-700">
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
                          <div className="py-4 space-y-4">
                            <div>
                              <Label>Assign Role</Label>
                              <Select value={activeApproveRole} onValueChange={(v) => setActiveApproveRole(v as "admin" | "loan_officer" | "data_entry")}>
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
                            {(activeApproveRole === 'loan_officer' || activeApproveRole === 'data_entry') && (
                              <div>
                                <Label>Assign Branch</Label>
                                <Select value={activeApproveBranch} onValueChange={setActiveApproveBranch}>
                                  <SelectTrigger className="mt-2">
                                    <SelectValue placeholder="Select a branch" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {branches.map((branch) => (
                                      <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </div>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleApprove(approval.user_id)}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              Approve with {getRoleDisplayName(activeApproveRole)} Role
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>

                      {/* Reject Dialog */}
                      <AlertDialog
                        onOpenChange={(open) => {
                          if (!open) resetRejectState();
                          else setActiveRejectReason("");
                        }}
                      >
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="destructive">
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
                              value={activeRejectReason}
                              onChange={(e) => setActiveRejectReason(e.target.value)}
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
            <CardDescription>Previously processed user registrations</CardDescription>
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
                        <p className="font-medium">{getUserDisplayName(approval)}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-sm text-muted-foreground">
                            Processed: {approval.approved_at ? new Date(approval.approved_at).toLocaleDateString() : 'N/A'}
                          </p>
                          {approval.status === 'approved' && approval.assigned_role && getRoleBadge(approval.assigned_role)}
                        </div>
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
                        <AlertDialog
                          onOpenChange={(open) => {
                            if (!open) resetDeactivateState();
                            else setActiveDeactivateReason("");
                          }}
                        >
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="destructive">
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
                                value={activeDeactivateReason}
                                onChange={(e) => setActiveDeactivateReason(e.target.value)}
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
