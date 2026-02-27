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
import { DollarSign } from "lucide-react";
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

interface PostClientFeeDialogProps {
  clientId: string;
  clientName: string;
  onFeePosted?: () => void;
}

const clientFeeTypes = [
  { value: "registration_fee", label: "Registration Fee" },
  { value: "membership_fee", label: "Membership Fee" },
  { value: "documentation_fee", label: "Documentation Fee" },
  { value: "account_maintenance_fee", label: "Account Maintenance Fee" },
  { value: "kyc_fee", label: "KYC Processing Fee" },
  { value: "card_issuance_fee", label: "Card Issuance Fee" },
  { value: "transaction_fee", label: "Transaction Fee" },
  { value: "other_fee", label: "Other Fee" },
];

const paymentMethods = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "mobile_money", label: "Mobile Money" },
  { value: "cheque", label: "Cheque" },
  { value: "card", label: "Card Payment" },
];

export function PostClientFeeDialog({ clientId, clientName, onFeePosted }: PostClientFeeDialogProps) {
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
      // First, we need to get or create a "virtual" loan for client fees
      // We'll create a special loan record to associate client fees with
      let { data: existingLoan, error: loanFetchError } = await supabase
        .from("loans")
        .select("id")
        .eq("client", clientName)
        .eq("type", "client_fee_account")
        .single();

      let loanId: string;

      if (loanFetchError && loanFetchError.code === 'PGRST116') {
        // No existing fee account, create one
        const { data: newLoan, error: loanCreateError } = await supabase
          .from("loans")
          .insert({
            client: clientName,
            type: "client_fee_account",
            status: "fee_account",
            amount: 0,
            balance: 0,
            date: new Date().toISOString().split('T')[0],
          })
          .select("id")
          .single();

        if (loanCreateError) throw loanCreateError;
        loanId = newLoan.id;
      } else if (loanFetchError) {
        throw loanFetchError;
      } else {
        loanId = existingLoan.id;
      }

      // Now create the fee transaction
      const { error } = await supabase
        .from("loan_transactions")
        .insert({
          loan_id: loanId,
          transaction_type: "client_fee",
          amount: parseFloat(values.amount),
          payment_method: values.payment_method,
          notes: `${values.fee_type}: ${values.notes || ""}`.trim(),
          receipt_number: values.receipt_number || null,
        });

      if (error) throw error;

      toast({
        title: "Client fee posted successfully",
        description: `Fee of KES ${parseFloat(values.amount).toLocaleString()} has been recorded for ${clientName}.`,
      });

      form.reset();
      setOpen(false);
      onFeePosted?.();
    } catch (error: any) {
      console.error("Error posting client fee:", error);
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
          Post Client Fee
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Post Client Fee</DialogTitle>
          <DialogDescription>
            Record a fee payment for {clientName}. This will be included in the transactions report.
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
                      {clientFeeTypes.map((type) => (
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