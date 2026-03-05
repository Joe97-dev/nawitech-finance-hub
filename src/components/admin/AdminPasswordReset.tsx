import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AdminPasswordResetProps {
  users: { id: string; email: string; role: string }[];
  isAdmin: boolean;
}

export function AdminPasswordReset({ users, isAdmin }: AdminPasswordResetProps) {
  const [selectedUserId, setSelectedUserId] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const nonAdminUsers = users.filter((u) => u.role !== "admin");

  const handleReset = async () => {
    if (!selectedUserId) {
      toast.error("Please select a user");
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await supabase.functions.invoke("admin-reset-password", {
        body: { target_user_id: selectedUserId, new_password: newPassword },
      });

      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);

      const selectedUser = users.find((u) => u.id === selectedUserId);
      toast.success(`Password reset successfully for ${selectedUser?.email}`);
      setDialogOpen(false);
      setNewPassword("");
      setConfirmPassword("");
      setSelectedUserId("");
    } catch (error: any) {
      toast.error("Failed to reset password: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5" />
          User Password Reset
        </CardTitle>
        <CardDescription>
          Reset passwords for loan officers and data entry users who have forgotten their credentials
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={() => setDialogOpen(true)} disabled={!isAdmin}>
          <KeyRound className="mr-2 h-4 w-4" />
          Reset User Password
        </Button>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reset User Password</DialogTitle>
              <DialogDescription>
                Set a new password for the selected user. They will use this to log in.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Select User</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a user" />
                  </SelectTrigger>
                  <SelectContent>
                    {nonAdminUsers.length === 0 ? (
                      <SelectItem value="none" disabled>
                        No users available
                      </SelectItem>
                    ) : (
                      nonAdminUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.email} ({u.role.replace("_", " ")})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>New Password</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Confirm Password</Label>
                <Input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleReset} disabled={loading}>
                {loading ? "Resetting..." : "Reset Password"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
