import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, DollarSign } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { getOrganizationId } from "@/lib/get-organization-id";
import { useToast } from "@/hooks/use-toast";

const PROCESSING_FEE_AMOUNT = 400;

const formSchema = z.object({
  amount: z.string().min(1, "Amount is required").refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
    message: "Amount must be a positive number",
  }),
  fee_type: z.string().min(1, "Fee type is required"),
  payment_method: z.string().min(1, "Payment method is required"),
  notes: z.string().optional(),
  receipt_number: z.string().optional(),
});

interface PostFeeDialogProps {
  loanId: string;
  onFeePosted?: () => void;
}

const feeTypes = [
  { value: "processing_fee", label: "Processing Fee" },
  { value: "administration_fee", label: "Administration Fee" },
  { value: "late_fee", label: "Late Payment Fee" },
  { value: "penalty_fee", label: "Penalty Fee" },
  { value: "appraisal_fee", label: "Appraisal Fee" },
  { value: "legal_fee", label: "Legal Fee" },
  { value: "insurance_fee", label: "Insurance Fee" },
  { value: "other_fee", label: "Other Fee" },
];

const paymentMethods = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "mobile_money", label: "Mobile Money" },
  { value: "cheque", label: "Cheque" },
  { value: "card", label: "Card Payment" },
  { value: "draw_down_account", label: "Draw Down Account" },
];

export function PostFeeDialog({ loanId, onFeePosted }: PostFeeDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingFeeTotal, setProcessingFeeTotal] = useState(0);
  const { toast } = useToast();
  const PROCESSING_FEE_AMOUNT = 400;
  const remainingProcessingFee = Math.max(0, PROCESSING_FEE_AMOUNT - processingFeeTotal);
  const processingFeeFullyPaid = processingFeeTotal >= PROCESSING_FEE_AMOUNT;

  const refreshFeeState = async () => {
    const { data } = await supabase
      .from("loan_transactions")
      .select("amount, notes")
      .eq("loan_id", loanId)
      .eq("transaction_type", "fee")
      .eq("is_reverted", false);
    const total = (data || [])
      .filter((t: any) => (t.notes || "").toLowerCase().startsWith("processing_fee"))
      .reduce((s: number, t: any) => s + Number(t.amount || 0), 0);
    setProcessingFeeTotal(total);
  };

  useEffect(() => {
    if (loanId) refreshFeeState();
  }, [loanId]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: "",
      fee_type: "",
      payment_method: "",
      notes: "",
      receipt_number: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      const feeAmount = parseFloat(values.amount);

      // For processing fee, enforce the 400 cap on the client (DB trigger also enforces this)
      if (values.fee_type === "processing_fee") {
        await refreshFeeState();
        const { data: existing } = await supabase
          .from("loan_transactions")
          .select("amount, notes")
          .eq("loan_id", loanId)
          .eq("transaction_type", "fee")
          .eq("is_reverted", false);
        const currentTotal = (existing || [])
          .filter((t: any) => (t.notes || "").toLowerCase().startsWith("processing_fee"))
          .reduce((s: number, t: any) => s + Number(t.amount || 0), 0);
        const remaining = PROCESSING_FEE_AMOUNT - currentTotal;
        if (remaining <= 0) {
          throw new Error("Processing fee of KES 400 has already been fully posted for this loan.");
        }
        if (feeAmount > remaining) {
          throw new Error(`Processing fee remaining is KES ${remaining.toLocaleString()}. You cannot post more than that.`);
        }
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      const organizationId = await getOrganizationId();

      // If paying from draw down account, deduct from client account first
      if (values.payment_method === "draw_down_account") {
        const { data: loanInfo, error: loanInfoError } = await supabase
          .from("loans")
          .select("client")
          .eq("id", loanId)
          .single();
        if (loanInfoError || !loanInfo) throw new Error("Could not find loan details");

        const { data: allClients, error: clientError } = await supabase
          .from("clients")
          .select("id, first_name, last_name")
          .eq("organization_id", organizationId);
        if (clientError) throw clientError;
        
        const clientData = allClients?.find(
          (cl) => `${cl.first_name} ${cl.last_name}` === loanInfo.client
        );
        if (!clientData) throw new Error("Could not find client for this loan");

        const { data: account, error: accountError } = await supabase
          .from("client_accounts")
          .select("id, balance")
          .eq("client_id", clientData.id)
          .maybeSingle();
        if (accountError) throw accountError;
        if (!account || account.balance < feeAmount) {
          throw new Error(`Insufficient draw down account balance. Available: KES ${(account?.balance || 0).toLocaleString()}`);
        }

        const { error: withdrawError } = await supabase
          .from("client_account_transactions")
          .insert({
            client_account_id: account.id,
            amount: -feeAmount,
            transaction_type: "withdrawal",
            related_loan_id: loanId,
            notes: `Fee withdrawal: ${values.fee_type}`,
            created_by: user?.id || null,
            previous_balance: account.balance,
            new_balance: account.balance - feeAmount,
            organization_id: organizationId,
          });
        if (withdrawError) throw withdrawError;
      }

      const { error } = await supabase
        .from("loan_transactions")
        .insert({
          loan_id: loanId,
          transaction_type: "fee",
          amount: feeAmount,
          payment_method: values.payment_method,
          notes: `${values.fee_type}: ${values.notes || ""}`.trim(),
          receipt_number: values.receipt_number || null,
          created_by: user?.id || null,
          organization_id: organizationId,
        });

      if (error) throw error;

      // Re-read status (DB trigger auto-activates once total reaches 400)
      const { data: loanData } = await supabase
        .from("loans")
        .select("status")
        .eq("id", loanId)
        .single();

      const newTotal = (values.fee_type === "processing_fee" ? processingFeeTotal + feeAmount : processingFeeTotal);
      const stillPending = loanData?.status === "pending";
      const activated = loanData?.status === "active" && newTotal >= PROCESSING_FEE_AMOUNT;

      toast({
        title: "Fee posted successfully",
        description: `Fee of KES ${feeAmount.toLocaleString()} has been recorded.${
          activated ? " Loan is now active." :
          stillPending && values.fee_type === "processing_fee" ? ` Processing fee total: KES ${newTotal.toLocaleString()} of KES 400. Loan stays pending until KES 400 is reached.` : ""
        }`,
      });

      form.reset();
      setOpen(false);
      await refreshFeeState();
      onFeePosted?.();
    } catch (error: any) {
      console.error("Error posting fee:", error);
      toast({
        variant: "destructive",
        title: "Failed to post fee",
        description: error.message || "An error occurred while posting the fee.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) refreshFeeState(); }}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
          disabled={processingFeeFullyPaid}
          title={processingFeeFullyPaid ? "Processing fee of KES 400 already fully posted." : undefined}
        >
          <DollarSign className="h-4 w-4" />
          {processingFeeFullyPaid ? "Fee Posted" : "Post Fee"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Post Loan Fee</DialogTitle>
          <DialogDescription>
            Record a fee payment for this loan. This will be included in the transactions report.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="rounded-md border bg-muted/50 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Processing fee posted</span>
                <span className="font-medium">KES {processingFeeTotal.toLocaleString()} / 400</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-muted-foreground">Remaining</span>
                <span className="font-medium">KES {remainingProcessingFee.toLocaleString()}</span>
              </div>
            </div>
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount (KES)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Enter fee amount"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="fee_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fee Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select fee type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {feeTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="payment_method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Method</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select payment method" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {paymentMethods.map((method) => (
                        <SelectItem key={method.value} value={method.value}>
                          {method.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="receipt_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Receipt Number (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter receipt number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional notes about this fee"
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Posting..." : "Post Fee"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}