import { useState, useEffect } from "react";
import { ReportPage } from "./Base";
import { DateRange } from "react-day-picker";
import { ExportButton } from "@/components/ui/export-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ReportFilters } from "@/components/reports/ReportFilters";
import { DateRangePicker } from "@/components/reports/DateRangePicker";
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

  const hasActiveFilters = selectedBranch !== "all" || searchQuery !== "" || (date !== undefined);

  const handleReset = () => {
    setSelectedBranch("all");
    setSearchQuery("");
    setDate(undefined);
  };

  const filters = (
    <ReportFilters 
      title="Loan Repayment Filters" 
      hasActiveFilters={hasActiveFilters}
      onReset={handleReset}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <DateRangePicker
          dateRange={date}
          onDateRangeChange={setDate}
          className="sm:col-span-2 lg:col-span-1"
        />

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Branch
          </label>
          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
            <SelectTrigger className="border-dashed">
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

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Search
          </label>
          <Input
            placeholder="Search by client name or phone"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border-dashed"
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
          filename={`loans-due-${selectedBranch}`} 
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
