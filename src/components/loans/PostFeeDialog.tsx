import { useState } from "react";
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
import { useToast } from "@/hooks/use-toast";

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
];

export function PostFeeDialog({ loanId, onFeePosted }: PostFeeDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

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
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("loan_transactions")
        .insert({
          loan_id: loanId,
          transaction_type: "fee",
          amount: parseFloat(values.amount),
          payment_method: values.payment_method,
          notes: `${values.fee_type}: ${values.notes || ""}`.trim(),
          receipt_number: values.receipt_number || null,
          created_by: user?.id || null,
        });

      if (error) throw error;

      // Activate the loan if it's still pending
      const { data: loanData } = await supabase
        .from("loans")
        .select("status")
        .eq("id", loanId)
        .single();

      if (loanData?.status === "pending") {
        const { error: updateError } = await supabase
          .from("loans")
          .update({ status: "active" })
          .eq("id", loanId);

        if (updateError) {
          console.error("Error activating loan:", updateError);
        }
      }

      toast({
        title: "Fee posted successfully",
        description: `Fee of KES ${parseFloat(values.amount).toLocaleString()} has been recorded.${loanData?.status === "pending" ? " Loan is now active." : ""}`,
      });

      form.reset();
      setOpen(false);
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <DollarSign className="h-4 w-4" />
          Post Fee
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