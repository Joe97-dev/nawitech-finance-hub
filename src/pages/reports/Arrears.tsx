
import { useState, useEffect } from "react";
import { ReportPage } from "./Base";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ExportButton } from "@/components/ui/export-button";
import { DateRange } from "react-day-picker";
import { DateRangePicker } from "@/components/reports/DateRangePicker";
import { Card } from "@/components/ui/card";
import { ReportFilters } from "@/components/reports/ReportFilters";
import { ReportStat, ReportStats } from "@/components/reports/ReportStats";
import { ReportCard } from "@/components/reports/ReportCard";
import { InterestCalculationToggle } from "@/components/reports/InterestCalculationToggle";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, ArrowUpRight, BarChart3, PieChart, TrendingDown } from "lucide-react";

// Interface for loans from Supabase
interface Loan {
  id: string;
  amount: number;
  balance: number;
  status: string;
  date: string;
}

// Process loans to calculate arrears
const calculateArrears = (loans: Loan[]) => {
  // Only consider active loans with a balance > 0
  const activeLoans = loans.filter(loan => loan.status === 'active' && loan.balance > 0);
  
  // For demo purposes, we'll use loan date to calculate days past due
  // In a real app, you would have specific due dates and payment data
  
  const today = new Date();
  
  // Calculate days past due for each loan
  const loansWithDaysPastDue = activeLoans.map(loan => {
    const loanDate = new Date(loan.date);
    const daysDifference = Math.round((today.getTime() - loanDate.getTime()) / (1000 * 60 * 60 * 24));
    
    return {
      ...loan,
      daysPastDue: daysDifference
    };
  });
  
  // Group loans by days past due categories
  const arrearsCategories = [
    { category: "1-7 days", min: 1, max: 7, amount: 0, count: 0, color: "#3b82f6" },
    { category: "8-14 days", min: 8, max: 14, amount: 0, count: 0, color: "#8b5cf6" },
    { category: "15-30 days", min: 15, max: 30, amount: 0, count: 0, color: "#ec4899" },
    { category: "31-60 days", min: 31, max: 60, amount: 0, count: 0, color: "#f59e0b" },
    { category: "61-90 days", min: 61, max: 90, amount: 0, count: 0, color: "#ef4444" },
    { category: "90+ days", min: 91, max: 999999, amount: 0, count: 0, color: "#7f1d1d" }
  ];
  
  // Sum up balances for each category
  for (const loan of loansWithDaysPastDue) {
    for (const category of arrearsCategories) {
      if (loan.daysPastDue >= category.min && loan.daysPastDue <= category.max) {
        category.amount += loan.balance;
        category.count += 1;
        break;
      }
    }
  }
  
  return arrearsCategories;
};

// Calculate PAR (Portfolio at Risk) metrics
const calculatePAR = (loans: Loan[]) => {
  const totalPortfolio = loans.reduce((sum, loan) => sum + loan.balance, 0);
  
  if (totalPortfolio === 0) return { 
    par30: 0, 
    par90: 0, 
    totalInArrears: 0,
    totalPortfolio: 0,
    loansInArrears: 0,
    totalLoans: loans.length
  };
  
  const today = new Date();
  
  // Sum all balances over 30 days past due
  const balanceOver30Days = loans.reduce((sum, loan) => {
    const loanDate = new Date(loan.date);
    const daysDifference = Math.round((today.getTime() - loanDate.getTime()) / (1000 * 60 * 60 * 24));
    return daysDifference > 30 ? sum + loan.balance : sum;
  }, 0);
  
  // Sum all balances over 90 days past due
  const balanceOver90Days = loans.reduce((sum, loan) => {
    const loanDate = new Date(loan.date);
    const daysDifference = Math.round((today.getTime() - loanDate.getTime()) / (1000 * 60 * 60 * 24));
    return daysDifference > 90 ? sum + loan.balance : sum;
  }, 0);
  
  // Sum all balances past due (over 1 day)
  const totalInArrears = loans.reduce((sum, loan) => {
    const loanDate = new Date(loan.date);
    const daysDifference = Math.round((today.getTime() - loanDate.getTime()) / (1000 * 60 * 60 * 24));
    return daysDifference > 0 ? sum + loan.balance : sum;
  }, 0);

  // Count loans in arrears
  const loansInArrears = loans.reduce((count, loan) => {
    const loanDate = new Date(loan.date);
    const daysDifference = Math.round((today.getTime() - loanDate.getTime()) / (1000 * 60 * 60 * 24));
    return daysDifference > 0 ? count + 1 : count;
  }, 0);
  
  const par30 = (balanceOver30Days / totalPortfolio) * 100;
  const par90 = (balanceOver90Days / totalPortfolio) * 100;
  
  return { 
    par30: parseFloat(par30.toFixed(1)), 
    par90: parseFloat(par90.toFixed(1)), 
    totalInArrears,
    totalPortfolio,
    loansInArrears,
    totalLoans: loans.length
  };
};

const columns = [
  { key: "category", header: "Days Past Due" },
  { key: "amount", header: "Amount in Arrears (KES)" },
  { key: "count", header: "Number of Loans" }
];

const ArrearsReport = () => {
  const { toast } = useToast();
  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(2025, 4, 1), // May 1, 2025
    to: new Date(),
  });
  const [interestCalculation, setInterestCalculation] = useState<"monthly" | "annually">("monthly");
  const [loading, setLoading] = useState(true);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [arrearsData, setArrearsData] = useState<any[]>([]);
  const [parData, setParData] = useState({ 
    par30: 0, 
    par90: 0, 
    totalInArrears: 0, 
    totalPortfolio: 0,
    loansInArrears: 0,
    totalLoans: 0
  });
  
  useEffect(() => {
    const fetchLoans = async () => {
      try {
        setLoading(true);
        
        // Get all loans from Supabase
        const { data, error } = await supabase
          .from('loans')
          .select('*');
        
        if (error) {
          throw error;
        }
        
        setLoans(data || []);
        
        // Calculate arrears based on loans
        const arrears = calculateArrears(data || []);
        setArrearsData(arrears);
        
        // Calculate PAR metrics
        const par = calculatePAR(data || []);
        setParData(par);
        
      } catch (error: any) {
        console.error("Error fetching loans for arrears report:", error);
        toast({
          variant: "destructive",
          title: "Failed to fetch loans",
          description: "There was an error loading the arrears data."
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchLoans();
  }, [toast]);

  const resetFilters = () => {
    setDate({
      from: new Date(2025, 4, 1),
      to: new Date(),
    });
    setInterestCalculation("monthly");
  };
  
  const hasActiveFilters = 
    (date?.from && date.from.getTime() !== new Date(2025, 4, 1).getTime()) || 
    (date?.to && date.to.getTime() !== new Date().getTime()) ||
    interestCalculation !== "monthly";
  
  const filters = (
    <ReportFilters 
      title="Arrears Analysis Filters" 
      onReset={resetFilters} 
      hasActiveFilters={hasActiveFilters}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-sm font-medium">Date Range</label>
          <DateRangePicker dateRange={date} onDateRangeChange={setDate} />
        </div>
        
        <InterestCalculationToggle
          value={interestCalculation}
          onChange={setInterestCalculation}
          className="space-y-2"
        />
      </div>
    </ReportFilters>
  );
  
  return (
    <ReportPage
      title="Arrears Report"
      description="Analysis of loans in arrears by time period."
      actions={
        <ExportButton 
          data={arrearsData.map(item => ({
            category: item.category,
            amount: item.amount,
            count: item.count
          }))} 
          filename="arrears-report" 
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
              label="Total Portfolio" 
              value={`KES ${parData.totalPortfolio.toLocaleString()}`}
              icon={<PieChart className="h-5 w-5" />}
              subValue={`${parData.totalLoans} total loans`}
            />
            <ReportStat 
              label="Total in Arrears" 
              value={`KES ${parData.totalInArrears.toLocaleString()}`}
              icon={<AlertCircle className="h-5 w-5" />}
              trend={parData.totalInArrears > 0 ? "up" : "neutral"}
              trendValue={`${parData.loansInArrears} loans affected`}
            />
            <ReportStat 
              label="Portfolio at Risk" 
              value={`${parData.par30}%`}
              icon={<TrendingDown className="h-5 w-5" />}
              subValue={
                <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                  <div className="h-2.5 rounded-full bg-amber-500" style={{ width: `${Math.min(100, parData.par30)}%` }} />
                </div>
              }
            />
          </ReportStats>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ReportCard
              title="Arrears Breakdown"
              description="Amount in arrears by days past due"
              className="lg:col-span-2"
            >
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={arrearsData}
                    margin={{
                      top: 20,
                      right: 30,
                      left: 20,
                      bottom: 5,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis 
                      dataKey="category" 
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => 
                        value >= 1000000
                          ? `${(value / 1000000).toFixed(1)}M`
                          : value >= 1000
                          ? `${(value / 1000).toFixed(0)}K`
                          : value.toString()
                      }
                    />
                    <Tooltip 
                      formatter={(value) => `KES ${value.toLocaleString()}`} 
                      cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }}
                      contentStyle={{ 
                        borderRadius: '8px', 
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                        border: '1px solid rgba(0, 0, 0, 0.1)'
                      }}
                    />
                    <Legend />
                    <Bar 
                      dataKey="amount" 
                      name="Amount in Arrears" 
                      fill="#8b5cf6" 
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ReportCard>

            <ReportCard 
              title="Arrears Distribution"
              description="Loans in arrears by category"
            >
              <div className="space-y-4 pt-3">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-muted/30">
                      <th className="pb-2 text-left text-xs font-medium text-muted-foreground">Category</th>
                      <th className="pb-2 text-right text-xs font-medium text-muted-foreground">Loans</th>
                      <th className="pb-2 text-right text-xs font-medium text-muted-foreground">Amount</th>
                      <th className="pb-2 text-right text-xs font-medium text-muted-foreground">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {arrearsData.map((category) => (
                      <tr key={category.category} className="border-b border-muted/20">
                        <td className="py-2">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-2 h-2 rounded-full" 
                              style={{ backgroundColor: category.color }}
                            />
                            <span className="text-sm">{category.category}</span>
                          </div>
                        </td>
                        <td className="text-right text-sm">{category.count}</td>
                        <td className="text-right text-sm">KES {category.amount.toLocaleString()}</td>
                        <td className="text-right text-sm">
                          {parData.totalInArrears > 0 
                            ? `${((category.amount / parData.totalInArrears) * 100).toFixed(1)}%` 
                            : '0%'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-muted/50">
                      <td className="py-3 text-sm font-medium">Total</td>
                      <td className="py-3 text-right text-sm font-medium">{parData.loansInArrears}</td>
                      <td colSpan={2} className="py-3 text-right text-sm font-medium">KES {parData.totalInArrears.toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </ReportCard>

            <ReportCard 
              title="PAR Trend"
              description="Portfolio at Risk metrics"
            >
              <div className="space-y-4 py-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-muted-foreground">PAR 30</span>
                    <span className="text-sm font-medium">{parData.par30}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="h-2 rounded-full bg-amber-500 transition-all duration-500" 
                      style={{ width: `${Math.min(100, parData.par30)}%` }}
                    />
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    KES {(parData.totalPortfolio * parData.par30 / 100).toLocaleString()} at risk
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-muted-foreground">PAR 90</span>
                    <span className="text-sm font-medium">{parData.par90}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="h-2 rounded-full bg-red-500 transition-all duration-500" 
                      style={{ width: `${Math.min(100, parData.par90)}%` }}
                    />
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    KES {(parData.totalPortfolio * parData.par90 / 100).toLocaleString()} at risk
                  </div>
                </div>

                <div className="pt-4">
                  <div className="flex justify-between items-center border-t border-muted/30 pt-4">
                    <div className="text-sm font-medium">Risk Assessment</div>
                    <div className={`px-2 py-1 rounded text-xs font-medium ${
                      parData.par30 > 10 ? 'bg-red-100 text-red-800' : 
                      parData.par30 > 5 ? 'bg-amber-100 text-amber-800' : 
                      'bg-green-100 text-green-800'
                    }`}>
                      {parData.par30 > 10 ? 'High Risk' : 
                       parData.par30 > 5 ? 'Medium Risk' : 'Low Risk'}
                    </div>
                  </div>
                </div>
              </div>
            </ReportCard>
          </div>
        </div>
      )}
    </ReportPage>
  );
};

export default ArrearsReport;
