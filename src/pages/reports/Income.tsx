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
        
        // Get transactions with income (fees, interest, penalties)
        let query = supabase
          .from('loan_transactions')
          .select('transaction_date, transaction_type, amount')
          .in('transaction_type', ['fee', 'interest', 'penalty'])
          .order('transaction_date', { ascending: true });

        // Apply date range filter if provided
        if (dateRange?.from) {
          query = query.gte('transaction_date', dateRange.from.toISOString().split('T')[0]);
        }
        if (dateRange?.to) {
          query = query.lte('transaction_date', dateRange.to.toISOString().split('T')[0]);
        } else {
          // Default to last 12 months if no date range
          const oneYearAgo = new Date();
          oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
          query = query.gte('transaction_date', oneYearAgo.toISOString().split('T')[0]);
        }

        const { data, error } = await query;
        
        if (error) throw error;
        
        // Group by month and transaction type
        const monthlyIncome = new Map<string, {
          interest_income: number;
          fee_income: number;
          penalty_income: number;
        }>();

        (data || []).forEach(transaction => {
          const date = new Date(transaction.transaction_date);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          
          if (!monthlyIncome.has(monthKey)) {
            monthlyIncome.set(monthKey, {
              interest_income: 0,
              fee_income: 0,
              penalty_income: 0
            });
          }
          
          const monthData = monthlyIncome.get(monthKey)!;
          
          switch (transaction.transaction_type) {
            case 'interest':
              monthData.interest_income += transaction.amount;
              break;
            case 'fee':
              monthData.fee_income += transaction.amount;
              break;
            case 'penalty':
              monthData.penalty_income += transaction.amount;
              break;
          }
        });

        // Convert to array and calculate totals
        const transformedData: IncomeData[] = Array.from(monthlyIncome.entries())
          .map(([monthKey, income]) => ({
            month: new Date(monthKey + '-01').toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'short' 
            }),
            interest_income: income.interest_income,
            fee_income: income.fee_income,
            penalty_income: income.penalty_income,
            total_income: income.interest_income + income.fee_income + income.penalty_income
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <DateRangePicker
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
        />
      </div>
      
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
        </div>
      )}
    </ReportPage>
  );
};

export default IncomeReport;