import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AbandonLoanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loanId: string;
  loanNumber: string;
  onLoanAbandoned: () => void;
}

export const AbandonLoanDialog = ({ open, onOpenChange, loanId, loanNumber, onLoanAbandoned }: AbandonLoanDialogProps) => {
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleAbandon = async () => {
    if (!reason.trim()) {
      toast({ variant: "destructive", title: "Reason required", description: "Please provide a reason for abandoning this loan." });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('loans')
        .update({ status: 'abandoned', abandon_reason: reason.trim() } as any)
        .eq('id', loanId);

      if (error) throw error;

      toast({ title: "Loan abandoned", description: `Loan ${loanNumber} has been marked as abandoned.` });
      setReason("");
      onOpenChange(false);
      onLoanAbandoned();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Failed to abandon loan", description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Abandon Loan {loanNumber}</DialogTitle>
          <DialogDescription>
            This action will mark the loan as abandoned. Abandoned loans will not count toward disbursed amounts. This action cannot be easily undone.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="abandon-reason">Reason for abandoning *</Label>
          <Textarea
            id="abandon-reason"
            placeholder="Enter the reason for abandoning this loan..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleAbandon} disabled={submitting || !reason.trim()}>
            {submitting ? "Abandoning..." : "Abandon Loan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
