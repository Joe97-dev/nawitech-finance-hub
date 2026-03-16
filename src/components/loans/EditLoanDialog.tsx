import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getOrganizationId } from "@/lib/get-organization-id";
import { useToast } from "@/hooks/use-toast";

interface LoanProduct {
  id: string;
  name: string;
  interest_rate: number;
  interest_method: string;
  term_min: number;
  term_max: number;
  term_unit: string;
}

interface LoanOfficer {
  id: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
}

interface EditLoanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loanId: string;
  onLoanUpdated: () => void;
}

export function EditLoanDialog({ open, onOpenChange, loanId, onLoanUpdated }: EditLoanDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);

  // Form state
  const [loanType, setLoanType] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [interestMethod, setInterestMethod] = useState("flat");
  const [frequency, setFrequency] = useState("monthly");
  const [loanOfficerId, setLoanOfficerId] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [regenerateSchedule, setRegenerateSchedule] = useState(false);

  // Reference data
  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [officers, setOfficers] = useState<LoanOfficer[]>([]);

  // Original loan data for schedule regeneration
  const [loanAmount, setLoanAmount] = useState(0);
  const [loanTermMonths, setLoanTermMonths] = useState(0);
  const [loanDate, setLoanDate] = useState("");

  useEffect(() => {
    if (!open) return;

    const fetchAll = async () => {
      setLoading(true);
      try {
        const organizationId = await getOrganizationId();

        const [
          { data: loan, error: loanErr },
          { data: prods, error: prodErr },
          { data: roles, error: rolesErr },
        ] = await Promise.all([
          supabase.from("loans").select("*").eq("id", loanId).single(),
          supabase.from("loan_products").select("*").eq("status", "active").order("name"),
          supabase.from("user_roles").select("user_id").eq("role", "loan_officer"),
        ]);

        if (loanErr) throw loanErr;

        // Set form state from loan
        setLoanType(loan.type || "");
        setInterestRate(String(loan.interest_rate || ""));
        setInterestMethod(loan.interest_method || "flat");
        setFrequency(loan.frequency || "monthly");
        setLoanOfficerId(loan.loan_officer_id || "");
        setLoanAmount(loan.amount);
        setLoanTermMonths(loan.term_months || 1);
        setLoanDate(loan.date);
        setSelectedProductId("");
        setRegenerateSchedule(false);

        setProducts((prods || []) as LoanProduct[]);

        // Fetch officer profiles
        if (!rolesErr && roles && roles.length > 0) {
          const userIds = [...new Set(roles.map(r => r.user_id))];
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, first_name, last_name, username")
            .in("id", userIds)
            .eq("organization_id", organizationId);
          setOfficers((profiles || []) as LoanOfficer[]);
        } else {
          setOfficers([]);
        }
      } catch (err: any) {
        toast({ variant: "destructive", title: "Error", description: err.message });
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [open, loanId]);

  const handleProductSelect = (productId: string) => {
    setSelectedProductId(productId);
    const product = products.find(p => p.id === productId);
    if (product) {
      setLoanType(product.name);
      setInterestRate(String(product.interest_rate));
      setInterestMethod(product.interest_method);
    }
  };

  const getOfficerName = (o: LoanOfficer) => {
    const name = [o.first_name, o.last_name].filter(Boolean).join(" ").trim();
    return name || o.username || o.id.substring(0, 8);
  };

  const handleSave = async () => {
    if (regenerateSchedule) {
      setShowRegenConfirm(true);
      return;
    }
    await saveChanges(false);
  };

  const saveChanges = async (withRegeneration: boolean) => {
    setSaving(true);
    try {
      // 1. Update loan fields
      const updateData: any = {
        type: loanType,
        interest_rate: parseFloat(interestRate),
        interest_method: interestMethod,
        frequency,
      };
      if (loanOfficerId) {
        updateData.loan_officer_id = loanOfficerId;
      }

      const { error: updateErr } = await supabase
        .from("loans")
        .update(updateData)
        .eq("id", loanId);

      if (updateErr) throw updateErr;

      // 2. Optionally regenerate schedule + replay payments
      if (withRegeneration) {
        setRegenerating(true);
        await regenerateAndReplay();
      }

      toast({ title: "Success", description: withRegeneration
        ? "Loan updated and schedule regenerated with payments re-allocated."
        : "Loan details updated successfully."
      });

      onLoanUpdated();
      onOpenChange(false);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setSaving(false);
      setRegenerating(false);
    }
  };

  const regenerateAndReplay = async () => {
    const rate = parseFloat(interestRate);

    // Step 1: Regenerate schedule via RPC
    const { error: schedErr } = await supabase.rpc("generate_loan_schedule", {
      p_loan_id: loanId,
      p_amount: loanAmount,
      p_interest_rate: rate,
      p_term_months: loanTermMonths,
      p_frequency: frequency,
      p_start_date: loanDate,
    });
    if (schedErr) throw schedErr;

    // Step 2: Get total non-reverted repayments
    const { data: transactions, error: txErr } = await supabase
      .from("loan_transactions")
      .select("amount")
      .eq("loan_id", loanId)
      .eq("transaction_type", "repayment")
      .eq("is_reverted", false);
    if (txErr) throw txErr;

    const totalPaid = (transactions || []).reduce((sum, t) => sum + Number(t.amount), 0);

    if (totalPaid <= 0) return;

    // Step 3: Fetch new schedule items (oldest first)
    const { data: scheduleItems, error: schFetchErr } = await supabase
      .from("loan_schedule")
      .select("*")
      .eq("loan_id", loanId)
      .order("due_date", { ascending: true });
    if (schFetchErr) throw schFetchErr;

    // Step 4: Allocate total payments across new schedule
    let remaining = totalPaid;
    for (const item of scheduleItems || []) {
      if (remaining <= 0) break;

      const allocation = Math.min(remaining, item.total_due);
      const newStatus = allocation >= item.total_due ? "paid" : allocation > 0 ? "partial" : "pending";

      const { error: upErr } = await supabase
        .from("loan_schedule")
        .update({ amount_paid: allocation, status: newStatus })
        .eq("id", item.id);
      if (upErr) throw upErr;

      remaining -= allocation;
    }

    // The trigger will auto-update the loan balance from the schedule
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Loan Details</DialogTitle>
            <DialogDescription>
              Update loan product, interest, frequency, or officer assignment.
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4 py-2">
              {/* Loan Product Selector */}
              <div className="space-y-2">
                <Label>Loan Product</Label>
                <Select value={selectedProductId} onValueChange={handleProductSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select to auto-fill from product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} — {p.interest_rate}% ({p.interest_method})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Loan Type */}
              <div className="space-y-2">
                <Label>Loan Type</Label>
                <Input
                  value={loanType}
                  onChange={(e) => setLoanType(e.target.value)}
                  readOnly={!!selectedProductId}
                />
              </div>

              {/* Interest Rate & Method */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Interest Rate (%)</Label>
                  <Input
                    type="number"
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value)}
                    readOnly={!!selectedProductId}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Interest Method</Label>
                  <Select
                    value={interestMethod}
                    onValueChange={setInterestMethod}
                    disabled={!!selectedProductId}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="flat">Flat Rate</SelectItem>
                      <SelectItem value="reducing">Reducing Balance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Frequency */}
              <div className="space-y-2">
                <Label>Repayment Frequency</Label>
                <Select value={frequency} onValueChange={setFrequency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="bi-weekly">Bi-weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Loan Officer */}
              <div className="space-y-2">
                <Label>Loan Officer</Label>
                <Select value={loanOfficerId} onValueChange={setLoanOfficerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select officer" />
                  </SelectTrigger>
                  <SelectContent>
                    {officers.map(o => (
                      <SelectItem key={o.id} value={o.id}>
                        {getOfficerName(o)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Regenerate Schedule Option */}
              <div className="flex items-start gap-3 rounded-md border p-3 bg-muted/50">
                <Checkbox
                  id="regen"
                  checked={regenerateSchedule}
                  onCheckedChange={(v) => setRegenerateSchedule(!!v)}
                />
                <div className="space-y-1">
                  <Label htmlFor="regen" className="font-medium cursor-pointer">
                    Regenerate repayment schedule
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Rebuilds the schedule with the new interest rate/method and re-allocates existing payments. Use when changing interest terms.
                  </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || loading}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {regenerating ? "Regenerating..." : "Saving..."}
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Regeneration Confirmation */}
      <AlertDialog open={showRegenConfirm} onOpenChange={setShowRegenConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Regenerate Repayment Schedule?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>This will:</p>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li>Delete the existing repayment schedule</li>
                <li>Create a new schedule based on updated interest rate, method, and frequency</li>
                <li>Re-allocate all existing payments to the new schedule (oldest installment first)</li>
                <li>Recalculate the outstanding balance</li>
              </ul>
              <p className="font-medium text-foreground pt-2">
                Transaction history is preserved. This action cannot be undone.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowRegenConfirm(false);
                saveChanges(true);
              }}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Yes, Regenerate Schedule
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
