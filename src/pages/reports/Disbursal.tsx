import { useState } from "react";
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

// Dummy data for loan disbursals
const disbursalData = [
  { id: 1, clientName: "John Kamau", phoneNumber: "0712345678", amount: 50000, disbursedDate: "2025-05-15", branch: "head-office", loanOfficer: "James Maina", loanTerm: "6 months", interestRate: 15 },
  { id: 2, clientName: "Mary Wanjiku", phoneNumber: "0723456789", amount: 35000, disbursedDate: "2025-05-16", branch: "head-office", loanOfficer: "James Maina", loanTerm: "4 months", interestRate: 15 },
  { id: 3, clientName: "Peter Ochieng", phoneNumber: "0734567890", amount: 25000, disbursedDate: "2025-05-17", branch: "westlands", loanOfficer: "Anne Wambui", loanTerm: "3 months", interestRate: 15 },
  { id: 4, clientName: "Lucy Muthoni", phoneNumber: "0745678901", amount: 40000, disbursedDate: "2025-05-18", branch: "westlands", loanOfficer: "Anne Wambui", loanTerm: "6 months", interestRate: 15 },
  { id: 5, clientName: "David Kiprop", phoneNumber: "0756789012", amount: 60000, disbursedDate: "2025-05-19", branch: "mombasa", loanOfficer: "Mark Otieno", loanTerm: "12 months", interestRate: 15 },
  { id: 6, clientName: "Sarah Njeri", phoneNumber: "0767890123", amount: 20000, disbursedDate: "2025-05-20", branch: "mombasa", loanOfficer: "Mark Otieno", loanTerm: "3 months", interestRate: 15 },
  { id: 7, clientName: "Michael Kamau", phoneNumber: "0778901234", amount: 30000, disbursedDate: "2025-05-15", branch: "kisumu", loanOfficer: "Susan Achieng", loanTerm: "6 months", interestRate: 15 },
  { id: 8, clientName: "Elizabeth Mwangi", phoneNumber: "0789012345", amount: 45000, disbursedDate: "2025-05-16", branch: "kisumu", loanOfficer: "Susan Achieng", loanTerm: "9 months", interestRate: 15 },
  { id: 9, clientName: "Robert Ndungu", phoneNumber: "0790123456", amount: 55000, disbursedDate: "2025-05-17", branch: "nakuru", loanOfficer: "Joseph Kirui", loanTerm: "12 months", interestRate: 15 },
  { id: 10, clientName: "Ruth Akinyi", phoneNumber: "0701234567", amount: 25000, disbursedDate: "2025-05-18", branch: "nakuru", loanOfficer: "Joseph Kirui", loanTerm: "4 months", interestRate: 15 },
  { id: 11, clientName: "Stephen Muthoni", phoneNumber: "0712345678", amount: 40000, disbursedDate: "2025-04-15", branch: "head-office", loanOfficer: "James Maina", loanTerm: "6 months", interestRate: 15 },
  { id: 12, clientName: "Dorothy Wangari", phoneNumber: "0723456789", amount: 30000, disbursedDate: "2025-04-20", branch: "westlands", loanOfficer: "Anne Wambui", loanTerm: "6 months", interestRate: 15 },
  { id: 13, clientName: "Henry Odhiambo", phoneNumber: "0734567890", amount: 50000, disbursedDate: "2025-04-25", branch: "mombasa", loanOfficer: "Mark Otieno", loanTerm: "12 months", interestRate: 15 },
  { id: 14, clientName: "Grace Wambui", phoneNumber: "0745678901", amount: 15000, disbursedDate: "2025-04-30", branch: "kisumu", loanOfficer: "Susan Achieng", loanTerm: "3 months", interestRate: 15 },
  { id: 15, clientName: "Martin Kiprono", phoneNumber: "0756789012", amount: 65000, disbursedDate: "2025-04-10", branch: "nakuru", loanOfficer: "Joseph Kirui", loanTerm: "12 months", interestRate: 15 }
];

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
  { key: "amount", header: "Amount (KES)" },
  { key: "disbursedDate", header: "Disbursed Date" },
  { key: "loanTerm", header: "Loan Term" },
  { key: "interestRate", header: "Interest Rate (%)" },
  { key: "loanOfficer", header: "Loan Officer" },
  { key: "branch", header: "Branch" }
];

const DisbursalReport = () => {
  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(2025, 3, 1), // April 1, 2025
    to: new Date(2025, 4, 31), // May 31, 2025
  });
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Filter data based on selected branch, date range and search query
  const filteredDisbursals = disbursalData.filter(loan => {
    const matchesBranch = selectedBranch === "all" || loan.branch === selectedBranch;
    
    // Check if loan falls within selected date range
    const disbursedDate = new Date(loan.disbursedDate);
    const isInDateRange = (!date?.from || disbursedDate >= date.from) && 
                           (!date?.to || disbursedDate <= date.to);
    
    // Check if loan matches search query
    const matchesSearch = searchQuery === "" || 
                         loan.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         loan.phoneNumber.includes(searchQuery) ||
                         loan.loanOfficer.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesBranch && isInDateRange && matchesSearch;
  });
  
  const totalDisbursed = filteredDisbursals.reduce((acc, loan) => acc + loan.amount, 0);
  
  // Group by branch
  const branchTotals = filteredDisbursals.reduce((acc: {[key: string]: number}, loan) => {
    const branch = loan.branch;
    if (!acc[branch]) {
      acc[branch] = 0;
    }
    acc[branch] += loan.amount;
    return acc;
  }, {});

  const hasActiveFilters = selectedBranch !== "all" || searchQuery !== "" || (date !== undefined);

  const handleReset = () => {
    setSelectedBranch("all");
    setSearchQuery("");
    setDate(undefined);
  };

  const filters = (
    <ReportFilters 
      title="Disbursal Report Filters" 
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
            placeholder="Search by client name, phone or loan officer" 
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
            ...loan,
            branch: branches.find(b => b.value === loan.branch)?.label || loan.branch,
            amount: loan.amount.toLocaleString()
          }))} 
          filename={`disbursal-report-${selectedBranch}`} 
          columns={columns} 
        />
      }
      filters={filters}
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.keys(branchTotals).length > 0 ? (
            Object.entries(branchTotals).map(([branch, total]) => (
              <div key={branch} className="bg-card border rounded-lg p-4 shadow-sm">
                <div className="text-sm text-muted-foreground">
                  {branches.find(b => b.value === branch)?.label || branch}
                </div>
                <div className="text-2xl font-bold mt-1">KES {total.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {filteredDisbursals.filter(loan => loan.branch === branch).length} loans
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-3 text-center py-8 text-muted-foreground border rounded-md">
              No disbursal data available for the selected criteria
            </div>
          )}
        </div>

        <div>
          <h3 className="text-lg font-medium mb-2">Loan Disbursals</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client Name</TableHead>
                <TableHead>Phone Number</TableHead>
                <TableHead>Amount (KES)</TableHead>
                <TableHead>Disbursed Date</TableHead>
                <TableHead>Loan Term</TableHead>
                <TableHead>Interest Rate</TableHead>
                <TableHead>Loan Officer</TableHead>
                <TableHead>Branch</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDisbursals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-4 text-muted-foreground">
                    No disbursals found in the selected date range
                  </TableCell>
                </TableRow>
              ) : (
                filteredDisbursals.map((loan) => (
                  <TableRow key={loan.id}>
                    <TableCell className="font-medium">{loan.clientName}</TableCell>
                    <TableCell>{loan.phoneNumber}</TableCell>
                    <TableCell>{loan.amount.toLocaleString()}</TableCell>
                    <TableCell>{loan.disbursedDate}</TableCell>
                    <TableCell>{loan.loanTerm}</TableCell>
                    <TableCell>{loan.interestRate}%</TableCell>
                    <TableCell>{loan.loanOfficer}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {branches.find(b => b.value === loan.branch)?.label || loan.branch}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </ReportPage>
  );
};

export default DisbursalReport;
