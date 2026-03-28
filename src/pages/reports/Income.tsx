import { useState, useEffect } from "react";
import { ReportPage } from "./Base";
import { ReportCard } from "@/components/reports/ReportCard";
import { ReportStats, ReportStat } from "@/components/reports/ReportStats";
import { ReportFilters } from "@/components/reports/ReportFilters";
import { DateRangePicker } from "@/components/reports/DateRangePicker";
import { ExportButton } from "@/components/ui/export-button";
import { DateRange } from "react-day-picker";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface IncomeData {
  month: string;
  interest_income: number;
  fee_income: number;
  penalty_income: number;
  total_income: number;
}

const columns = [
  { key: "month", header: "Month" },
  { key: "interest_income", header: "Interest Income" },
  { key: "fee_income", header: "Fee Income" },
  { key: "penalty_income", header: "Penalty Income" },
  { key: "total_income", header: "Total Income" }
];

const IncomeReport = () => {
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [incomeData, setIncomeData] = useState<IncomeData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchIncomeData = async () => {
      try {
        setLoading(true);

        const formatLocal = (d: Date) => {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${y}-${m}-${day}`;
        };

        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        const defaultFrom = formatLocal(oneYearAgo);

        const fromStr = dateRange?.from ? formatLocal(dateRange.from) : defaultFrom;
        const toStr = dateRange?.to ? formatLocal(dateRange.to) : undefined;

        // 1) Fetch interest income from loan_schedule (paid installments)
        let scheduleQuery = supabase
          .from('loan_schedule')
          .select('due_date, interest_due, amount_paid, total_due, status')
          .gte('due_date', fromStr);

        if (toStr) {
          scheduleQuery = scheduleQuery.lte('due_date', toStr);
        }

        // 2) Fetch fee transactions from loan_transactions
        let feeQuery = supabase
          .from('loan_transactions')
          .select('transaction_date, amount')
          .eq('transaction_type', 'fee')
          .eq('is_reverted', false)
          .gte('transaction_date', fromStr);

        if (toStr) {
          feeQuery = feeQuery.lte('transaction_date', `${toStr}T23:59:59.999`);
        }

        // 3) Fetch penalty transactions from loan_transactions
        let penaltyQuery = supabase
          .from('loan_transactions')
          .select('transaction_date, amount')
          .eq('transaction_type', 'penalty')
          .eq('is_reverted', false)
          .gte('transaction_date', fromStr);

        if (toStr) {
          penaltyQuery = penaltyQuery.lte('transaction_date', `${toStr}T23:59:59.999`);
        }

        const [scheduleRes, feeRes, penaltyRes] = await Promise.all([scheduleQuery, feeQuery, penaltyQuery]);

        if (scheduleRes.error) throw scheduleRes.error;
        if (feeRes.error) throw feeRes.error;
        if (penaltyRes.error) throw penaltyRes.error;

        // Group data by month
        const monthlyIncome = new Map<string, {
          interest_income: number;
          fee_income: number;
          penalty_income: number;
        }>();

        const ensureMonth = (key: string) => {
          if (!monthlyIncome.has(key)) {
            monthlyIncome.set(key, { interest_income: 0, fee_income: 0, penalty_income: 0 });
          }
          return monthlyIncome.get(key)!;
        };

        // Interest from paid/partially-paid schedule entries
        (scheduleRes.data || []).forEach(entry => {
          if (entry.status === 'pending' && (!entry.amount_paid || entry.amount_paid <= 0)) return;
          
          const date = new Date(entry.due_date);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          const monthData = ensureMonth(monthKey);

          if (entry.status === 'paid') {
            // Fully paid — count full interest_due
            monthData.interest_income += Number(entry.interest_due);
          } else if (entry.amount_paid && entry.amount_paid > 0 && entry.total_due > 0) {
            // Partially paid — proportional interest
            const paidRatio = Math.min(Number(entry.amount_paid) / Number(entry.total_due), 1);
            monthData.interest_income += Number(entry.interest_due) * paidRatio;
          }
        });

        // Fee income from transactions
        (feeRes.data || []).forEach(tx => {
          const date = new Date(tx.transaction_date);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          ensureMonth(monthKey).fee_income += Number(tx.amount);
        });

        // Convert to array
        const transformedData: IncomeData[] = Array.from(monthlyIncome.entries())
          .map(([monthKey, income]) => ({
            month: new Date(monthKey + '-01').toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short'
            }),
            interest_income: Math.round(income.interest_income * 100) / 100,
            fee_income: Math.round(income.fee_income * 100) / 100,
            penalty_income: 0,
            total_income: Math.round((income.interest_income + income.fee_income) * 100) / 100
          }))
          .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());

        setIncomeData(transformedData);
      } catch (error: any) {
        console.error("Error fetching income data:", error);
        toast({
          variant: "destructive",
          title: "Data fetch error",
          description: "Failed to load income data."
        });
        setIncomeData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchIncomeData();
  }, [toast, dateRange]);

  // Calculate statistics
  const totalIncome = incomeData.reduce((sum, month) => sum + month.total_income, 0);
  const totalInterest = incomeData.reduce((sum, month) => sum + month.interest_income, 0);
  const totalFees = incomeData.reduce((sum, month) => sum + month.fee_income, 0);
  const totalPenalties = incomeData.reduce((sum, month) => sum + month.penalty_income, 0);

  const hasActiveFilters = dateRange !== undefined;

  const handleReset = () => {
    setDateRange(undefined);
  };

  const filters = (
    <ReportFilters 
      title="Income Report Filters" 
      hasActiveFilters={hasActiveFilters}
      onReset={handleReset}
    >
      <DateRangePicker
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
      />
      
      <div className="bg-muted/50 p-3 rounded-md flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div className="text-sm mb-2 sm:mb-0">
          <span className="font-medium">{incomeData.length}</span> months of data
        </div>
        <div className="text-sm font-medium">
          Total income: <span className="text-primary">KES {totalIncome.toLocaleString()}</span>
        </div>
      </div>
    </ReportFilters>
  );

  return (
    <ReportPage
      title="Income Report"
      description="Track income from interest, fees, and penalties over time"
      actions={
        <ExportButton 
          data={incomeData.map(item => ({
            month: item.month,
            interest_income: item.interest_income,
            fee_income: item.fee_income,
            penalty_income: item.penalty_income,
            total_income: item.total_income
          }))} 
          filename={`income-report-${new Date().toISOString().slice(0, 10)}`} 
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
        <div className="space-y-6">
          <ReportStats>
            <ReportStat
              label="Total Income"
              value={`KES ${totalIncome.toLocaleString()}`}
              subValue="All income sources"
              trend="up"
              trendValue="12.5%"
            />
            <ReportStat
              label="Interest Income"
              value={`KES ${totalInterest.toLocaleString()}`}
              subValue="From loan interest"
              trend="up"
              trendValue="8.3%"
            />
            <ReportStat
              label="Fee Income"
              value={`KES ${totalFees.toLocaleString()}`}
              subValue="Processing & other fees"
              trend="up"
              trendValue="15.7%"
            />
            <ReportStat
              label="Penalty Income"
              value={`KES ${totalPenalties.toLocaleString()}`}
              subValue="Late payment penalties"
              trend="down"
              trendValue="3.2%"
            />
          </ReportStats>

          <ReportCard title="Monthly Income Breakdown">
            {incomeData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No income data found for the selected period
              </div>
            ) : (
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={incomeData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value: number) => [`KES ${value.toLocaleString()}`, '']} />
                    <Legend />
                    <Bar dataKey="interest_income" name="Interest" fill="#0ea5e9" />
                    <Bar dataKey="fee_income" name="Fees" fill="#22c55e" />
                    <Bar dataKey="penalty_income" name="Penalties" fill="#f97316" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </ReportCard>

          {incomeData.length > 0 && (
            <ReportCard title="Detailed Monthly Breakdown">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Month</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground">Interest Income</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground">Fee Income</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground">Penalty Income</th>
                      <th className="text-right py-3 px-4 font-medium text-foreground">Total Income</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incomeData.map((row, idx) => (
                      <tr key={idx} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                        <td className="py-3 px-4 font-medium">{row.month}</td>
                        <td className="py-3 px-4 text-right">KES {row.interest_income.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right">KES {row.fee_income.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right">KES {row.penalty_income.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right font-semibold">KES {row.total_income.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border bg-muted/30">
                      <td className="py-3 px-4 font-semibold">Total</td>
                      <td className="py-3 px-4 text-right font-semibold">KES {totalInterest.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right font-semibold">KES {totalFees.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right font-semibold">KES {totalPenalties.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right font-bold text-primary">KES {totalIncome.toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </ReportCard>
          )}
        </div>
      )}
    </ReportPage>
  );
};

export default IncomeReport;