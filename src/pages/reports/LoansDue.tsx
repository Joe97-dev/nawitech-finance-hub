
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
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { ReportFilters } from "@/components/reports/ReportFilters";
import { ReportStat, ReportStats } from "@/components/reports/ReportStats";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Loan {
  id: string;
  client: string;
  amount: number;
  balance: number;
  date: string;
  type: string;
  status: string;
  due_date?: string;
  branch?: string;
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
  { key: "clientName", header: "Client Name" },
  { key: "phoneNumber", header: "Phone Number" },
  { key: "amountDue", header: "Amount Due (KES)" },
  { key: "dueDate", header: "Due Date" },
  { key: "branch", header: "Branch" }
];

const LoansDueReport = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(2025, 4, 20), // May 20, 2025
    to: new Date(2025, 5, 20), // June 20, 2025
  });
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loans, setLoans] = useState<Loan[]>([]);
  
  useEffect(() => {
    const fetchLoans = async () => {
      try {
        setLoading(true);
        
        // Get active loans from Supabase
        const { data, error } = await supabase
          .from('loans')
          .select('*')
          .eq('status', 'active');
        
        if (error) {
          throw error;
        }
        
        // Map loan data to expected format
        const activeLoans = data || [];
        
        setLoans(activeLoans);
      } catch (error: any) {
        console.error("Error fetching loans:", error);
        toast({
          variant: "destructive",
          title: "Failed to fetch loans",
          description: "There was an error loading the loans data."
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchLoans();
  }, [toast]);
  
  // Filter loans based on selected branch, date range, and search query
  const filteredLoans = loans.filter(loan => {
    // Since we don't have actual branch and due date in the current schema, we'll use placeholder logic
    // This should be updated when the schema provides these details
    const loanDate = new Date(loan.date);
    const isInDateRange = (!date?.from || loanDate >= date.from) && 
                           (!date?.to || loanDate <= date.to);
    
    // Check if loan matches search query
    const matchesSearch = searchQuery === "" || 
                         loan.client.toLowerCase().includes(searchQuery.toLowerCase());
    
    return isInDateRange && matchesSearch;
  });
  
  const totalAmountDue = filteredLoans.reduce((acc, loan) => acc + loan.balance, 0);

  const filters = (
    <ReportFilters title="Loan Repayment Filters">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Date Range</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="date"
                variant={"outline"}
                className={cn(
                  "w-full justify-start text-left font-normal",
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

        <div className="space-y-2">
          <label className="text-sm font-medium">Branch</label>
          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
            <SelectTrigger>
              <SelectValue placeholder="Select Branch" />
            </SelectTrigger>
            <SelectContent>
              {branches.map((branch) => (
                <SelectItem key={branch.value} value={branch.value}>
                  {branch.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Search</label>
          <Input
            placeholder="Search by client name or phone"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>
      
      <div className="mt-4 bg-muted/50 p-3 rounded-md flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div className="text-sm mb-2 sm:mb-0">
          <span className="font-medium">{filteredLoans.length}</span> loans due for repayment
        </div>
        <div className="text-sm font-medium">
          Total amount due: <span className="text-primary">KES {totalAmountDue.toLocaleString()}</span>
        </div>
      </div>
    </ReportFilters>
  );
  
  return (
    <ReportPage
      title="Loans Due Report"
      description="View upcoming loan repayments by date range"
      actions={
        <ExportButton 
          data={filteredLoans.map(loan => ({
            clientName: loan.client,
            phoneNumber: "-", // No phone number in current schema
            amountDue: loan.balance,
            dueDate: loan.date,
            branch: "Not specified", // No branch in current schema
          }))} 
          filename={`loans-due-${selectedBranch}-${date?.from ? format(date.from, 'yyyy-MM-dd') : ''}-${date?.to ? 'to-' + format(date.to, 'yyyy-MM-dd') : ''}`} 
          columns={columns} 
        />
      }
      filters={filters}
    >
      <Card className="shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client Name</TableHead>
                <TableHead>Amount Due (KES)</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                    Loading loans...
                  </TableCell>
                </TableRow>
              ) : filteredLoans.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                    No loans due in the selected date range
                  </TableCell>
                </TableRow>
              ) : (
                filteredLoans.map((loan) => (
                  <TableRow 
                    key={loan.id}
                    className="cursor-pointer hover:bg-muted"
                    onClick={() => navigate(`/loans/${loan.id}`)}
                  >
                    <TableCell className="font-medium">{loan.client}</TableCell>
                    <TableCell>KES {loan.balance.toLocaleString()}</TableCell>
                    <TableCell>{loan.date}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {loan.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/loans/${loan.id}`)}>
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </ReportPage>
  );
};

export default LoansDueReport;
