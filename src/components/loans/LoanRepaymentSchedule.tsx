
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";

interface ScheduleItem {
  id: string;
  due_date: string;
  principal_due: number;
  interest_due: number;
  total_due: number;
  status: "pending" | "partial" | "paid" | "overdue";
}

interface LoanRepaymentScheduleProps {
  loanId: string;
}

export function LoanRepaymentSchedule({ loanId }: LoanRepaymentScheduleProps) {
  const { toast } = useToast();
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRepaymentSchedule = async () => {
      try {
        const { data, error } = await supabase
          .from('loan_schedule')
          .select('*')
          .eq('loan_id', loanId)
          .order('due_date', { ascending: true });
        
        if (error) throw error;
        setScheduleItems(data || []);
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Error",
          description: `Failed to fetch repayment schedule: ${error.message}`
        });
      } finally {
        setLoading(false);
      }
    };

    fetchRepaymentSchedule();
  }, [loanId, toast]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Paid</Badge>;
      case "partial":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Partial</Badge>;
      case "overdue":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Overdue</Badge>;
      default:
        return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">Pending</Badge>;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-40">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Repayment Schedule</h3>
      
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Due Date</TableHead>
              <TableHead>Principal</TableHead>
              <TableHead>Interest</TableHead>
              <TableHead>Total Due</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {scheduleItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                  No repayment schedule available
                </TableCell>
              </TableRow>
            ) : (
              scheduleItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    {new Date(item.due_date).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {formatCurrency(item.principal_due)}
                  </TableCell>
                  <TableCell>
                    {formatCurrency(item.interest_due)}
                  </TableCell>
                  <TableCell>
                    {formatCurrency(item.total_due)}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(item.status)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
