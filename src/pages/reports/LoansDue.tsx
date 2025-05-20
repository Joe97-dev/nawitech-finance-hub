
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

// Dummy data for loans due
const loansDueData = [
  { id: 1, clientName: "John Kamau", phoneNumber: "0712345678", amountDue: 35000, dueDate: "2025-05-25", branch: "head-office" },
  { id: 2, clientName: "Mary Wanjiku", phoneNumber: "0723456789", amountDue: 42000, dueDate: "2025-05-26", branch: "head-office" },
  { id: 3, clientName: "Peter Ochieng", phoneNumber: "0734567890", amountDue: 28000, dueDate: "2025-05-27", branch: "head-office" },
  { id: 4, clientName: "Lucy Muthoni", phoneNumber: "0745678901", amountDue: 50000, dueDate: "2025-05-28", branch: "head-office" },
  { id: 5, clientName: "David Kiprop", phoneNumber: "0756789012", amountDue: 65000, dueDate: "2025-05-29", branch: "head-office" },
  { id: 6, clientName: "Alice Wairimu", phoneNumber: "0712345679", amountDue: 22000, dueDate: "2025-05-25", branch: "westlands" },
  { id: 7, clientName: "Bob Mugo", phoneNumber: "0723456780", amountDue: 30000, dueDate: "2025-05-26", branch: "westlands" },
  { id: 8, clientName: "Carol Wekesa", phoneNumber: "0734567891", amountDue: 18000, dueDate: "2025-05-27", branch: "westlands" },
  { id: 9, clientName: "Frank Odinga", phoneNumber: "0767890124", amountDue: 25000, dueDate: "2025-05-25", branch: "mombasa" },
  { id: 10, clientName: "Gloria Hassan", phoneNumber: "0778901235", amountDue: 33000, dueDate: "2025-05-26", branch: "mombasa" },
  { id: 11, clientName: "Kevin Onyango", phoneNumber: "0712345670", amountDue: 20000, dueDate: "2025-05-25", branch: "kisumu" },
  { id: 12, clientName: "Linda Achieng", phoneNumber: "0723456781", amountDue: 28000, dueDate: "2025-05-26", branch: "kisumu" },
  { id: 13, clientName: "Oscar Kipchoge", phoneNumber: "0756789014", amountDue: 15000, dueDate: "2025-05-25", branch: "nakuru" },
  { id: 14, clientName: "Patricia Cherono", phoneNumber: "0767890125", amountDue: 22000, dueDate: "2025-05-26", branch: "nakuru" },
  { id: 15, clientName: "Thomas Kariuki", phoneNumber: "0787654321", amountDue: 45000, dueDate: "2025-06-10", branch: "head-office" },
  { id: 16, clientName: "Sophia Wambui", phoneNumber: "0798765432", amountDue: 37000, dueDate: "2025-06-08", branch: "westlands" },
  { id: 17, clientName: "Victor Kimani", phoneNumber: "0709876543", amountDue: 28000, dueDate: "2025-06-15", branch: "mombasa" },
  { id: 18, clientName: "Winnie Oduor", phoneNumber: "0721098765", amountDue: 52000, dueDate: "2025-06-12", branch: "kisumu" },
  { id: 19, clientName: "Xavier Mwangi", phoneNumber: "0732109876", amountDue: 33000, dueDate: "2025-06-20", branch: "nakuru" },
  { id: 20, clientName: "Yvonne Njeri", phoneNumber: "0743210987", amountDue: 41000, dueDate: "2025-06-18", branch: "head-office" }
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
  { key: "amountDue", header: "Amount Due (KES)" },
  { key: "dueDate", header: "Due Date" },
  { key: "branch", header: "Branch" }
];

const LoansDueReport = () => {
  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(2025, 4, 20), // May 20, 2025
    to: new Date(2025, 5, 20), // June 20, 2025
  });
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Filter data based on selected branch, date range and search query
  const filteredLoans = loansDueData.filter(loan => {
    const matchesBranch = selectedBranch === "all" || loan.branch === selectedBranch;
    
    // Check if loan falls within selected date range
    const loanDate = new Date(loan.dueDate);
    const isInDateRange = (!date?.from || loanDate >= date.from) && 
                           (!date?.to || loanDate <= date.to);
    
    // Check if loan matches search query
    const matchesSearch = searchQuery === "" || 
                         loan.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         loan.phoneNumber.includes(searchQuery);
    
    return matchesBranch && isInDateRange && matchesSearch;
  });
  
  const totalAmountDue = filteredLoans.reduce((acc, loan) => acc + loan.amountDue, 0);
  
  return (
    <ReportPage
      title="Loans Due Report"
      description="View upcoming loan repayments by date range"
      actions={
        <div className="flex flex-col gap-2 w-full">
          <div className="flex flex-col sm:flex-row items-center gap-2 w-full">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant={"outline"}
                  className={cn(
                    "justify-start text-left font-normal w-full sm:w-auto",
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
                />
              </PopoverContent>
            </Popover>
            
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger className="w-full sm:w-48">
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
            
            <Input 
              placeholder="Search by client name or phone" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-auto flex-1"
            />
            
            <ExportButton 
              data={filteredLoans.map(loan => ({
                ...loan,
                branch: branches.find(b => b.value === loan.branch)?.label || loan.branch
              }))} 
              filename={`loans-due-${selectedBranch}-${date?.from ? format(date.from, 'yyyy-MM-dd') : ''}-${date?.to ? 'to-' + format(date.to, 'yyyy-MM-dd') : ''}`} 
              columns={columns} 
            />
          </div>
          
          <div className="flex items-center justify-between bg-muted/50 p-2 rounded-md">
            <div className="text-sm">
              <span className="font-medium">{filteredLoans.length}</span> loans due for repayment
            </div>
            <div className="text-sm font-medium">
              Total amount due: <span className="text-primary">KES {totalAmountDue.toLocaleString()}</span>
            </div>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client Name</TableHead>
              <TableHead>Phone Number</TableHead>
              <TableHead>Amount Due (KES)</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Branch</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLoans.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                  No loans due in the selected date range
                </TableCell>
              </TableRow>
            ) : (
              filteredLoans.map((loan) => (
                <TableRow key={loan.id}>
                  <TableCell className="font-medium">{loan.clientName}</TableCell>
                  <TableCell>{loan.phoneNumber}</TableCell>
                  <TableCell>{loan.amountDue.toLocaleString()}</TableCell>
                  <TableCell>{loan.dueDate}</TableCell>
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
    </ReportPage>
  );
};

export default LoansDueReport;
