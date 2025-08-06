import { useState, useEffect } from "react";
import { ReportPage } from "./Base";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { ExportButton } from "@/components/ui/export-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DateRange } from "react-day-picker";
import { ReportFilters } from "@/components/reports/ReportFilters";
import { DateRangePicker } from "@/components/reports/DateRangePicker";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface LoanPerformanceData {
  product: string;
  disbursed: number;
  outstanding: number;
  collected: number;
  interest: number;
  onTime: number;
  defaultRate: number;
  color: string;
}

const columns = [
  { key: "product", header: "Loan Product" },
  { key: "disbursed", header: "Disbursed Amount (KES)" },
  { key: "outstanding", header: "Outstanding (KES)" },
  { key: "collected", header: "Collected (KES)" },
  { key: "interest", header: "Interest Earned (KES)" },
  { key: "onTime", header: "On-Time Repayment (%)" },
  { key: "defaultRate", header: "Default Rate (%)" }
];

const colors = ["#0ea5e9", "#22c55e", "#f97316", "#8b5cf6", "#ef4444", "#f59e0b"];

const LoanPerformanceReport = () => {
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [loanPerformanceData, setLoanPerformanceData] = useState<LoanPerformanceData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLoanPerformanceData = async () => {
      try {
        setLoading(true);
        
        // Get loan products first
        const { data: loanProducts, error: productsError } = await supabase
          .from('loan_products')
          .select('id, name')
          .eq('status', 'active');

        if (productsError) throw productsError;

        // Get loans with their transactions
        let loansQuery = supabase
          .from('loans')
          .select(`
            id,
            amount,
            balance,
            type,
            date,
            status
          `);

        // Apply date filter if provided
        if (dateRange?.from) {
          loansQuery = loansQuery.gte('date', dateRange.from.toISOString().split('T')[0]);
        }
        if (dateRange?.to) {
          loansQuery = loansQuery.lte('date', dateRange.to.toISOString().split('T')[0]);
        }

        const { data: loans, error: loansError } = await loansQuery;
        if (loansError) throw loansError;

        // Get all transactions for these loans
        const { data: transactions, error: transactionsError } = await supabase
          .from('loan_transactions')
          .select('loan_id, amount, transaction_type')
          .in('loan_id', loans?.map(l => l.id) || []);

        if (transactionsError) throw transactionsError;

        // Group data by loan type
        const performanceByType: Record<string, {
          disbursed: number;
          outstanding: number;
          collected: number;
          interest: number;
          loanCount: number;
          defaultedLoans: number;
        }> = {};

        loans?.forEach(loan => {
          const type = loan.type || 'Other';
          if (!performanceByType[type]) {
            performanceByType[type] = {
              disbursed: 0,
              outstanding: 0,
              collected: 0,
              interest: 0,
              loanCount: 0,
              defaultedLoans: 0
            };
          }

          performanceByType[type].disbursed += Number(loan.amount);
          performanceByType[type].outstanding += Number(loan.balance);
          performanceByType[type].loanCount += 1;

          // Check if loan is defaulted (simplified logic)
          if (loan.status === 'defaulted') {
            performanceByType[type].defaultedLoans += 1;
          }

          // Calculate collections and interest from transactions
          const loanTransactions = transactions?.filter(t => t.loan_id === loan.id) || [];
          loanTransactions.forEach(transaction => {
            if (transaction.transaction_type === 'payment') {
              performanceByType[type].collected += Number(transaction.amount);
            } else if (transaction.transaction_type === 'interest') {
              performanceByType[type].interest += Number(transaction.amount);
            }
          });
        });

        // Convert to component format
        const performanceData: LoanPerformanceData[] = Object.entries(performanceByType).map(([type, data], index) => {
          const defaultRate = data.loanCount > 0 ? (data.defaultedLoans / data.loanCount) * 100 : 0;
          const onTimeRate = Math.max(0, 100 - defaultRate); // Simplified calculation
          
          return {
            product: type,
            disbursed: data.disbursed,
            outstanding: data.outstanding,
            collected: data.collected,
            interest: data.interest,
            onTime: Math.round(onTimeRate),
            defaultRate: Number(defaultRate.toFixed(2)),
            color: colors[index % colors.length]
          };
        });

        setLoanPerformanceData(performanceData);
      } catch (error: any) {
        console.error("Error fetching loan performance data:", error);
        toast({
          variant: "destructive",
          title: "Data fetch error",
          description: "Failed to load loan performance data."
        });
        setLoanPerformanceData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchLoanPerformanceData();
  }, [toast, dateRange]);

  const totalDisbursed = loanPerformanceData.reduce((acc, item) => acc + item.disbursed, 0);
  const totalOutstanding = loanPerformanceData.reduce((acc, item) => acc + item.outstanding, 0);
  const totalInterestEarned = loanPerformanceData.reduce((acc, item) => acc + item.interest, 0);
  
  const weightedDefaultRate = totalDisbursed > 0 ? loanPerformanceData.reduce((acc, item) => {
    return acc + (item.defaultRate * item.disbursed / totalDisbursed);
  }, 0).toFixed(2) : "0.00";

  // Prepare chart data
  const portionByProduct = loanPerformanceData.map(item => ({
    name: item.product,
    value: item.disbursed,
    color: item.color
  }));

  const hasActiveFilters = dateRange !== undefined;

  const handleReset = () => {
    setDateRange(undefined);
  };

  const filters = (
    <ReportFilters 
      title="Loan Performance Filters" 
      hasActiveFilters={hasActiveFilters}
      onReset={handleReset}
    >
      <DateRangePicker
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        className="w-full sm:w-auto"
      />
    </ReportFilters>
  );

  return (
    <ReportPage
      title="Loan Performance Report"
      description="Analysis of loan performance by product."
      actions={
        <ExportButton 
          data={loanPerformanceData.map(item => ({
            product: item.product,
            disbursed: item.disbursed,
            outstanding: item.outstanding,
            collected: item.collected,
            interest: item.interest,
            onTime: item.onTime,
            defaultRate: item.defaultRate
          }))} 
          filename="loan-performance-report" 
          columns={columns} 
        />
      }
      filters={filters}
    >
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="stats-card">
              <h3 className="stats-label">Total Disbursed</h3>
              <p className="stats-value">KES {totalDisbursed.toLocaleString()}</p>
            </div>
            <div className="stats-card">
              <h3 className="stats-label">Total Outstanding</h3>
              <p className="stats-value">KES {totalOutstanding.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">
                {totalDisbursed > 0 ? Math.round((totalOutstanding / totalDisbursed) * 100) : 0}% of disbursed amount
              </p>
            </div>
            <div className="stats-card">
              <h3 className="stats-label">Average Default Rate</h3>
              <p className="stats-value">{weightedDefaultRate}%</p>
            </div>
          </div>
          
          {loanPerformanceData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No loan performance data found for the selected period
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="h-80">
                <h3 className="text-lg font-semibold mb-2">Disbursed Amount by Product</h3>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={portionByProduct}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {portionByProduct.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `KES ${value.toLocaleString()}`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-2">Interest Earned: KES {totalInterestEarned.toLocaleString()}</h3>
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Loan Product</TableHead>
                        <TableHead>Interest Earned</TableHead>
                        <TableHead>Default Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loanPerformanceData.map((item) => (
                        <TableRow key={item.product}>
                          <TableCell>{item.product}</TableCell>
                          <TableCell>KES {item.interest.toLocaleString()}</TableCell>
                          <TableCell>{item.defaultRate}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </ReportPage>
  );
};

export default LoanPerformanceReport;
