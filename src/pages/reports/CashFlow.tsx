import { useState, useEffect } from "react";
import { ReportPage } from "./Base";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ExportButton } from "@/components/ui/export-button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { ReportFilters } from "@/components/reports/ReportFilters";
import { ReportStat, ReportStats } from "@/components/reports/ReportStats";
import { DateRange } from "react-day-picker";
import { DateRangePicker } from "@/components/reports/DateRangePicker";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CashFlowData {
  month: string;
  disbursements: number;
  repayments: number;
  net: number;
}

const columns = [
  { key: "month", header: "Month" },
  { key: "disbursements", header: "Disbursements (KES)" },
  { key: "repayments", header: "Repayments (KES)" },
  { key: "net", header: "Net Cash Flow (KES)" }
];

const years = ["2025", "2024", "2023"];

const CashFlowReport = () => {
  const { toast } = useToast();
  const [selectedYear, setSelectedYear] = useState("2025");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [cashFlowData, setCashFlowData] = useState<CashFlowData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCashFlowData = async () => {
      try {
        setLoading(true);
        
        // Get disbursements (loan creations)
        const startDate = dateRange?.from || new Date(parseInt(selectedYear), 0, 1);
        const endDate = dateRange?.to || new Date(parseInt(selectedYear), 11, 31);
        
        const { data: disbursements, error: disbursementsError } = await supabase
          .from('loans')
          .select('amount, date')
          .gte('date', startDate.toISOString().split('T')[0])
          .lte('date', endDate.toISOString().split('T')[0]);

        if (disbursementsError) throw disbursementsError;

        // Get repayments (transactions)
        const { data: transactions, error: transactionsError } = await supabase
          .from('loan_transactions')
          .select('amount, transaction_date')
          .eq('transaction_type', 'repayment')
          .gte('transaction_date', startDate.toISOString())
          .lte('transaction_date', endDate.toISOString());

        if (transactionsError) throw transactionsError;

        // Group by month
        const monthlyData: Record<string, { disbursements: number; repayments: number }> = {};
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        // Initialize all months
        months.forEach(month => {
          monthlyData[month] = { disbursements: 0, repayments: 0 };
        });

        // Process disbursements
        disbursements?.forEach(loan => {
          const month = months[new Date(loan.date).getMonth()];
          monthlyData[month].disbursements += Number(loan.amount);
        });

        // Process repayments
        transactions?.forEach(transaction => {
          const month = months[new Date(transaction.transaction_date).getMonth()];
          monthlyData[month].repayments += Number(transaction.amount);
        });

        // Convert to chart format
        const chartData: CashFlowData[] = months.map(month => ({
          month,
          disbursements: monthlyData[month].disbursements,
          repayments: monthlyData[month].repayments,
          net: monthlyData[month].repayments - monthlyData[month].disbursements
        }));

        setCashFlowData(chartData);
      } catch (error: any) {
        console.error("Error fetching cash flow data:", error);
        toast({
          variant: "destructive",
          title: "Data fetch error",
          description: "Failed to load cash flow data."
        });
        setCashFlowData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCashFlowData();
  }, [toast, selectedYear, dateRange]);
  
  const yearlyDisbursements = cashFlowData.reduce(
    (acc, month) => acc + month.disbursements, 
    0
  );
  
  const yearlyRepayments = cashFlowData.reduce(
    (acc, month) => acc + month.repayments, 
    0
  );
  
  const yearlyNetCashflow = yearlyRepayments - yearlyDisbursements;

  const hasActiveFilters = selectedYear !== "2025" || (dateRange !== undefined);

  const handleReset = () => {
    setSelectedYear("2025");
    setDateRange(undefined);
  };

  const filters = (
    <ReportFilters 
      title="Cash Flow Analysis Filters"
      hasActiveFilters={hasActiveFilters}
      onReset={handleReset}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DateRangePicker
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
        />
        
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Year
          </label>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="border-dashed">
              <SelectValue placeholder="Select Year" />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={year}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </ReportFilters>
  );

  return (
    <ReportPage
      title="Cash Flow Report"
      description="Monthly analysis of cash inflows and outflows."
      actions={
        <ExportButton 
          data={cashFlowData.map(item => ({
            month: item.month,
            disbursements: item.disbursements,
            repayments: item.repayments,
            net: item.net
          }))} 
          filename={`cash-flow-report-${selectedYear}`} 
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
              label="Total Disbursements" 
              value={`KES ${yearlyDisbursements.toLocaleString()}`}
              className="border-l-4 border-l-red-500"
            />
            <ReportStat 
              label="Total Repayments" 
              value={`KES ${yearlyRepayments.toLocaleString()}`}
              className="border-l-4 border-l-green-500"
            />
            <ReportStat 
              label="Net Cash Flow" 
              value={`KES ${yearlyNetCashflow.toLocaleString()}`}
              className={`border-l-4 ${yearlyNetCashflow >= 0 ? 'border-l-green-500' : 'border-l-red-500'}`}
            />
          </ReportStats>
          
          <Card className="shadow-sm">
            <CardContent className="pt-6">
              <h3 className="text-lg font-medium mb-4">Monthly Cash Flow</h3>
              {cashFlowData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No cash flow data found for the selected period
                </div>
              ) : (
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={cashFlowData}
                      margin={{
                        top: 20,
                        right: 30,
                        left: 20,
                        bottom: 5,
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value) => `KES ${value.toLocaleString()}`} />
                      <Legend />
                      <Bar dataKey="disbursements" name="Disbursements" fill="#ef4444" />
                      <Bar dataKey="repayments" name="Repayments" fill="#22c55e" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </ReportPage>
  );
};

export default CashFlowReport;
