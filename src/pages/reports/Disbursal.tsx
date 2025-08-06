import { useState, useEffect } from "react";
import { ReportPage } from "./Base";
import { format } from "date-fns";
import { CalendarRange } from "lucide-react";
import { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ExportButton } from "@/components/ui/export-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ReportFilters } from "@/components/reports/ReportFilters";
import { DateRangePicker } from "@/components/reports/DateRangePicker";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DisbursalData {
  id: string;
  client_name: string;
  loan_number: string;
  amount: number;
  disbursed_date: string;
  term_months: number;
  interest_rate: number;
}

const branches = [
  { value: "all", label: "All Branches" },
  { value: "head-office", label: "HEAD OFFICE" },
  { value: "westlands", label: "Westlands Branch" },
  { value: "mombasa", label: "Mombasa Branch" },
  { value: "kisumu", label: "Kisumu Branch" },
  { value: "nakuru", label: "Nakuru Branch" }
];

const columns = [
  { key: "client_name", header: "Client Name" },
  { key: "loan_number", header: "Loan Number" },
  { key: "amount", header: "Amount (KES)" },
  { key: "disbursed_date", header: "Disbursed Date" },
  { key: "term_months", header: "Loan Term (Months)" },
  { key: "interest_rate", header: "Interest Rate (%)" }
];

const DisbursalReport = () => {
  const { toast } = useToast();
  const [date, setDate] = useState<DateRange | undefined>();
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [disbursalData, setDisbursalData] = useState<DisbursalData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDisbursalData = async () => {
      try {
        setLoading(true);
        
        // Fetch loans with status 'approved' or 'disbursed' that have been disbursed
        let query = supabase
          .from('loans')
          .select('id, client, loan_number, amount, date, term_months, interest_rate')
          .in('status', ['approved', 'disbursed', 'active'])
          .order('date', { ascending: false });

        // Apply date range filter
        if (date?.from) {
          query = query.gte('date', date.from.toISOString().split('T')[0]);
        }
        if (date?.to) {
          query = query.lte('date', date.to.toISOString().split('T')[0]);
        }

        const { data, error } = await query;
        
        if (error) throw error;
        
        const transformedData: DisbursalData[] = (data || []).map(loan => ({
          id: loan.id,
          client_name: loan.client,
          loan_number: loan.loan_number || 'N/A',
          amount: loan.amount,
          disbursed_date: loan.date,
          term_months: loan.term_months || 12,
          interest_rate: loan.interest_rate || 15
        }));

        setDisbursalData(transformedData);
      } catch (error: any) {
        console.error("Error fetching disbursal data:", error);
        toast({
          variant: "destructive",
          title: "Data fetch error",
          description: "Failed to load disbursal data."
        });
        setDisbursalData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDisbursalData();
  }, [toast, date]);
  
  // Filter data based on search query
  const filteredDisbursals = disbursalData.filter(loan => {
    const matchesSearch = searchQuery === "" || 
                         loan.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         loan.loan_number.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesSearch;
  });
  
  const totalDisbursed = filteredDisbursals.reduce((acc, loan) => acc + loan.amount, 0);

  const hasActiveFilters = searchQuery !== "" || (date !== undefined);

  const handleReset = () => {
    setSearchQuery("");
    setDate(undefined);
  };

  const filters = (
    <ReportFilters 
      title="Disbursal Report Filters" 
      hasActiveFilters={hasActiveFilters}
      onReset={handleReset}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <DateRangePicker
          dateRange={date}
          onDateRangeChange={setDate}
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
          <span className="font-medium">{filteredDisbursals.length}</span> loans disbursed
        </div>
        <div className="text-sm font-medium">
          Total disbursed: <span className="text-primary">KES {totalDisbursed.toLocaleString()}</span>
        </div>
      </div>
    </ReportFilters>
  );
  
  return (
    <ReportPage
      title="Disbursal Report"
      description="Loans disbursed within a specific date range"
      actions={
        <ExportButton 
          data={filteredDisbursals.map(loan => ({
            client_name: loan.client_name,
            loan_number: loan.loan_number,
            amount: loan.amount.toLocaleString(),
            disbursed_date: new Date(loan.disbursed_date).toLocaleDateString(),
            term_months: loan.term_months,
            interest_rate: loan.interest_rate
          }))} 
          filename={`disbursal-report-${new Date().toISOString().slice(0, 10)}`} 
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
          <div className="bg-card border rounded-lg p-4 shadow-sm">
            <div className="text-sm text-muted-foreground">Total Disbursed</div>
            <div className="text-2xl font-bold mt-1">KES {totalDisbursed.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {filteredDisbursals.length} loans
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium mb-2">Loan Disbursals</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client Name</TableHead>
                  <TableHead>Loan Number</TableHead>
                  <TableHead>Amount (KES)</TableHead>
                  <TableHead>Disbursed Date</TableHead>
                  <TableHead>Loan Term</TableHead>
                  <TableHead>Interest Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDisbursals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                      No disbursals found for the selected criteria
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDisbursals.map((loan) => (
                    <TableRow key={loan.id}>
                      <TableCell className="font-medium">{loan.client_name}</TableCell>
                      <TableCell className="font-mono text-sm">{loan.loan_number}</TableCell>
                      <TableCell>{loan.amount.toLocaleString()}</TableCell>
                      <TableCell>{new Date(loan.disbursed_date).toLocaleDateString()}</TableCell>
                      <TableCell>{loan.term_months} months</TableCell>
                      <TableCell>{loan.interest_rate}%</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </ReportPage>
  );
};

export default DisbursalReport;
