
import { useState, useEffect } from "react";
import { ReportPage } from "./Base";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ExportButton } from "@/components/ui/export-button";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CalendarRange } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ReportFilters } from "@/components/reports/ReportFilters";
import { ReportStat, ReportStats } from "@/components/reports/ReportStats";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
    { category: "1-7 days", min: 1, max: 7, amount: 0 },
    { category: "8-14 days", min: 8, max: 14, amount: 0 },
    { category: "15-30 days", min: 15, max: 30, amount: 0 },
    { category: "31-60 days", min: 31, max: 60, amount: 0 },
    { category: "61-90 days", min: 61, max: 90, amount: 0 },
    { category: "90+ days", min: 91, max: 999999, amount: 0 }
  ];
  
  // Sum up balances for each category
  for (const loan of loansWithDaysPastDue) {
    for (const category of arrearsCategories) {
      if (loan.daysPastDue >= category.min && loan.daysPastDue <= category.max) {
        category.amount += loan.balance;
        break;
      }
    }
  }
  
  return arrearsCategories;
};

// Calculate PAR (Portfolio at Risk) metrics
const calculatePAR = (loans: Loan[]) => {
  const totalPortfolio = loans.reduce((sum, loan) => sum + loan.balance, 0);
  
  if (totalPortfolio === 0) return { par30: 0, par90: 0, totalInArrears: 0 };
  
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
  
  const par30 = (balanceOver30Days / totalPortfolio) * 100;
  const par90 = (balanceOver90Days / totalPortfolio) * 100;
  
  return { 
    par30: parseFloat(par30.toFixed(1)), 
    par90: parseFloat(par90.toFixed(1)), 
    totalInArrears 
  };
};

const columns = [
  { key: "category", header: "Days Past Due" },
  { key: "amount", header: "Amount in Arrears (KES)" }
];

const ArrearsReport = () => {
  const { toast } = useToast();
  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(2025, 4, 1), // May 1, 2025
    to: new Date(),
  });
  const [loading, setLoading] = useState(true);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [arrearsData, setArrearsData] = useState<any[]>([]);
  const [parData, setParData] = useState({ par30: 0, par90: 0, totalInArrears: 0 });
  
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
  
  const filters = (
    <ReportFilters title="Arrears Analysis Filters">
      <div className="space-y-2">
        <label className="text-sm font-medium">Analysis Period</label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              id="date"
              variant={"outline"}
              className={cn(
                "w-full sm:w-auto justify-start text-left font-normal",
                !date && "text-muted-foreground"
              )}
            >
              <CalendarRange className="mr-2 h-4 w-4" />
              {date?.from ? (
                date.to ? (
                  <>
                    {format(date.from, "LLL dd, y")} -{" "}
                    {format(date.to, "LLL dd, y")}
                  </>
                ) : (
                  format(date.from, "LLL dd, y")
                )
              ) : (
                <span>Pick a date range</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={date?.from}
              selected={date}
              onSelect={setDate}
              numberOfMonths={2}
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      </div>
    </ReportFilters>
  );
  
  return (
    <ReportPage
      title="Arrears Report"
      description="Analysis of loans in arrears by time period."
      actions={
        <ExportButton data={arrearsData} filename="arrears-report" columns={columns} />
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
              label="Total in Arrears" 
              value={`KES ${parData.totalInArrears.toLocaleString()}`}
            />
            <ReportStat 
              label="PAR 30" 
              value={`${parData.par30}%`}
              subValue={
                <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                  <div className="h-2.5 rounded-full bg-yellow-400" style={{ width: `${parData.par30}%` }} />
                </div>
              }
            />
            <ReportStat 
              label="PAR 90" 
              value={`${parData.par90}%`}
              subValue={
                <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                  <div className="h-2.5 rounded-full bg-green-600" style={{ width: `${parData.par90}%` }} />
                </div>
              }
            />
          </ReportStats>
          
          <Card className="shadow-sm">
            <CardContent className="pt-6">
              <h3 className="text-lg font-medium mb-4">Arrears Breakdown</h3>
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
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="category" />
                    <YAxis />
                    <Tooltip formatter={(value) => `KES ${value.toLocaleString()}`} />
                    <Legend />
                    <Bar dataKey="amount" name="Amount in Arrears" fill="#9b87f5" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </ReportPage>
  );
};

export default ArrearsReport;
