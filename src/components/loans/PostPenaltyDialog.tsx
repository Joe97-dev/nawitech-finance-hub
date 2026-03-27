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
import { AlertTriangle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { getOrganizationId } from "@/lib/get-organization-id";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  amount: z.string().min(1, "Amount is required").refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
    message: "Amount must be a positive number",
  }),
  notes: z.string().min(1, "Reason for penalty is required"),
});

interface PostPenaltyDialogProps {
  loanId: string;
  onPenaltyPosted?: () => void;
}

export function PostPenaltyDialog({ loanId, onPenaltyPosted }: PostPenaltyDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: "",
      notes: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const organizationId = await getOrganizationId();
      const penaltyAmount = parseFloat(values.amount);

      // 1. Insert the penalty transaction
      const { error: txError } = await supabase
        .from("loan_transactions")
        .insert({
          loan_id: loanId,
          transaction_type: "penalty" as any,
          amount: penaltyAmount,
          payment_method: null,
          notes: `Penalty: ${values.notes}`,
          receipt_number: null,
          created_by: user.id,
          organization_id: organizationId,
        });

      if (txError) throw txError;

      // 2. Add a penalty schedule entry (due today) to increase outstanding balance
      const today = new Date().toISOString().split("T")[0];
      const { error: scheduleError } = await supabase
        .from("loan_schedule")
        .insert({
          loan_id: loanId,
          due_date: today,
          principal_due: penaltyAmount,
          interest_due: 0,
          total_due: penaltyAmount,
          amount_paid: 0,
          status: "pending",
          organization_id: organizationId,
        });

      if (scheduleError) throw scheduleError;

      toast({
        title: "Penalty posted",
        description: `Penalty of KES ${penaltyAmount.toLocaleString()} has been added to the loan balance.`,
      });

      form.reset();
      setOpen(false);
      onPenaltyPosted?.();
    } catch (error: any) {
      console.error("Error posting penalty:", error);
      toast({
        variant: "destructive",
        title: "Failed to post penalty",
        description: error.message || "An error occurred.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2 text-destructive border-destructive/30 hover:bg-destructive/10">
          <AlertTriangle className="h-4 w-4" />
          Post Penalty
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Post Penalty</DialogTitle>
          <DialogDescription>
            Add a penalty to this loan. The amount will be added to the outstanding balance.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Penalty Amount (KES)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" placeholder="Enter penalty amount" {...field} />
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
                  <FormLabel>Reason</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Reason for the penalty" className="resize-none" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={isSubmitting}>
                {isSubmitting ? "Posting..." : "Post Penalty"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
