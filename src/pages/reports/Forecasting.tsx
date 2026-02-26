import { useState, useEffect } from "react";
import { ReportPage } from "./Base";
import { ReportCard } from "@/components/reports/ReportCard";
import { ReportStats, ReportStat } from "@/components/reports/ReportStats";
import { ReportFilters } from "@/components/reports/ReportFilters";
import { DateRangePicker } from "@/components/reports/DateRangePicker";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExportButton } from "@/components/ui/export-button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DateRange } from "react-day-picker";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ForecastingData {
  id: string;
  client_name: string;
  loan_number: string;
  amount_due: number;
  due_date: string;
  total_amount: number;
  status: string;
}

const columns = [
  { key: "client_name", header: "Client Name" },
  { key: "loan_number", header: "Loan Number" },
  { key: "amount_due", header: "Amount Due" },
  { key: "due_date", header: "Due Date" },
  { key: "total_amount", header: "Total Amount" },
  { key: "status", header: "Status" }
];

const ForecastingReport = () => {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [forecastingData, setForecastingData] = useState<ForecastingData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchForecastingData = async () => {
      try {
        setLoading(true);
        
        // Get upcoming loan schedule items that are due
        let query = supabase
          .from('loan_schedule')
          .select(`
            id,
            loan_id,
            due_date,
            total_due,
            amount_paid,
            status,
            loans!inner(
              client,
              loan_number,
              amount
            )
          `)
          .gte('due_date', (() => {
            const d = new Date();
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          })())
          .order('due_date', { ascending: true });

        const formatLocal = (d: Date) => {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${y}-${m}-${day}`;
        };

        // Apply date range filter if provided
        if (dateRange?.from) {
          query = query.gte('due_date', formatLocal(dateRange.from));
        }
        if (dateRange?.to) {
          query = query.lte('due_date', formatLocal(dateRange.to));
        }

        const { data, error } = await query;
        
        if (error) throw error;
        
        const transformedData: ForecastingData[] = (data || []).map(item => {
          const loan = (item.loans as any);
          const outstandingAmount = item.total_due - (item.amount_paid || 0);
          
          return {
            id: item.id,
            client_name: loan.client,
            loan_number: loan.loan_number || 'N/A',
            amount_due: outstandingAmount,
            due_date: item.due_date,
            total_amount: loan.amount,
            status: item.status
          };
        }).filter(item => item.amount_due > 0); // Only show items with outstanding amounts

        setForecastingData(transformedData);
      } catch (error: any) {
        console.error("Error fetching forecasting data:", error);
        toast({
          variant: "destructive",
          title: "Data fetch error",
          description: "Failed to load forecasting data."
        });
        setForecastingData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchForecastingData();
  }, [toast, dateRange]);

  // Filter data based on search query
  const filteredData = forecastingData.filter(item => {
    if (!searchQuery) return true;
    
    const searchLower = searchQuery.toLowerCase();
    return (
      item.client_name.toLowerCase().includes(searchLower) ||
      item.loan_number.toLowerCase().includes(searchLower)
    );
  });

  const hasActiveFilters = searchQuery !== "" || (dateRange !== undefined);

  const handleReset = () => {
    setSearchQuery("");
    setDateRange(undefined);
  };

  // Calculate statistics
  const totalExpectedAmount = filteredData.reduce((sum, item) => sum + item.amount_due, 0);
  const upcomingThisWeek = filteredData.filter(item => {
    const dueDate = new Date(item.due_date);
    const weekFromNow = new Date();
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    return dueDate <= weekFromNow;
  });
  const upcomingThisMonth = filteredData.filter(item => {
    const dueDate = new Date(item.due_date);
    const monthFromNow = new Date();
    monthFromNow.setMonth(monthFromNow.getMonth() + 1);
    return dueDate <= monthFromNow;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline">Pending</Badge>;
      case "partial":
        return <Badge variant="secondary">Partial</Badge>;
      case "paid":
        return <Badge variant="default">Paid</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filters = (
    <ReportFilters 
      title="Cash Flow Forecasting Filters" 
      hasActiveFilters={hasActiveFilters}
      onReset={handleReset}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <DateRangePicker
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
        />
        
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Search
          </label>
          <Input 
            placeholder="Search by client name or loan number" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border-dashed"
          />
        </div>
      </div>
      
      <div className="bg-muted/50 p-3 rounded-md flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div className="text-sm mb-2 sm:mb-0">
          <span className="font-medium">{filteredData.length}</span> upcoming payments
        </div>
        <div className="text-sm font-medium">
          Expected amount: <span className="text-primary">KES {totalExpectedAmount.toLocaleString()}</span>
        </div>
      </div>
    </ReportFilters>
  );

  return (
    <ReportPage
      title="Cash Flow Forecasting Report"
      description="Predict upcoming cash flows based on expected loan repayments"
      actions={
        <ExportButton 
          data={filteredData.map(item => ({
            client_name: item.client_name,
            loan_number: item.loan_number,
            amount_due: item.amount_due,
            due_date: new Date(item.due_date).toLocaleDateString(),
            total_amount: item.total_amount,
            status: item.status
          }))} 
          filename={`forecasting-report-${new Date().toISOString().slice(0, 10)}`} 
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
              label="Total Expected"
              value={`KES ${totalExpectedAmount.toLocaleString()}`}
              subValue="All upcoming payments"
              trend="up"
              trendValue="15%"
            />
            <ReportStat
              label="This Week"
              value={`KES ${upcomingThisWeek.reduce((sum, item) => sum + item.amount_due, 0).toLocaleString()}`}
              subValue={`${upcomingThisWeek.length} payments`}
              trend="up"
              trendValue="8%"
            />
            <ReportStat
              label="This Month"
              value={`KES ${upcomingThisMonth.reduce((sum, item) => sum + item.amount_due, 0).toLocaleString()}`}
              subValue={`${upcomingThisMonth.length} payments`}
              trend="up"
              trendValue="22%"
            />
            <ReportStat
              label="Total Payments"
              value={filteredData.length.toString()}
              subValue="Scheduled payments"
              trend="up"
              trendValue="5%"
            />
          </ReportStats>

          <ReportCard title="Upcoming Payments Schedule">
            {filteredData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No upcoming payments found for the selected criteria
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client Name</TableHead>
                    <TableHead>Loan Number</TableHead>
                    <TableHead>Amount Due</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Total Loan</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.client_name}</TableCell>
                      <TableCell className="font-mono text-sm">{item.loan_number}</TableCell>
                      <TableCell className="font-medium">KES {item.amount_due.toLocaleString()}</TableCell>
                      <TableCell>{new Date(item.due_date).toLocaleDateString()}</TableCell>
                      <TableCell>KES {item.total_amount.toLocaleString()}</TableCell>
                      <TableCell>{getStatusBadge(item.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ReportCard>
        </div>
      )}
    </ReportPage>
  );
};

export default ForecastingReport;