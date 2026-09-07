import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface Branch {
  id: string;
  name: string;
}

interface AddStaffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branches: Branch[];
  onCreated: () => void;
}

type Role = "admin" | "loan_officer" | "data_entry";

export const AddStaffDialog = ({ open, onOpenChange, branches, onCreated }: AddStaffDialogProps) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("data_entry");
  const [branchId, setBranchId] = useState("");

  const reset = () => {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPassword("");
    setRole("data_entry");
    setBranchId("");
  };

  const handleSubmit = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || password.length < 8) {
      toast({
        title: "Missing details",
        description: "Enter first name, last name, email and a password of at least 8 characters.",
        variant: "destructive",
      });
      return;
    }
    if ((role === "loan_officer" || role === "data_entry") && !branchId) {
      toast({
        title: "Branch required",
        description: "Select the branch this staff member works at.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: {
          email: email.trim(),
          password,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          role,
          branch_id: branchId || null,
        },
      });

      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      toast({
        title: "Staff account created",
        description: `${firstName} ${lastName} can now sign in with that email and password.`,
      });
      reset();
      onOpenChange(false);
      onCreated();
    } catch (err: any) {
      console.error("Error creating staff:", err);
      toast({
        title: "Could not create the account",
        description: err.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Add Staff</DialogTitle>
          <DialogDescription>
            Create an account directly. The person can sign in straight away — no approval needed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="staff-first">First Name</Label>
              <Input id="staff-first" className="mt-2" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="staff-last">Last Name</Label>
              <Input id="staff-last" className="mt-2" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>

          <div>
            <Label htmlFor="staff-email">Email</Label>
            <Input
              id="staff-email"
              type="email"
              className="mt-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="staff-password">Temporary Password</Label>
            <Input
              id="staff-password"
              type="text"
              className="mt-2"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div>
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
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

          {(role === "loan_officer" || role === "data_entry") && (
            <div>
              <Label>Branch</Label>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select a branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
