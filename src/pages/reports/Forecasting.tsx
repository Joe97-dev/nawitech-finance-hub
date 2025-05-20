
import { useState } from "react";
import { ReportPage } from "./Base";
import { format, addDays } from "date-fns";
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

// Dummy data for forecasting
const forecastingData = [
  { id: 1, clientName: "Thomas Kariuki", phoneNumber: "0787654321", amountDue: 45000, dueDate: "2025-06-10", branch: "head-office", loanId: 201, disbursedDate: "2024-12-10", totalAmount: 50000 },
  { id: 2, clientName: "Sophia Wambui", phoneNumber: "0798765432", amountDue: 37000, dueDate: "2025-06-08", branch: "westlands", loanId: 202, disbursedDate: "2024-12-08", totalAmount: 40000 },
  { id: 3, clientName: "Victor Kimani", phoneNumber: "0709876543", amountDue: 28000, dueDate: "2025-06-15", branch: "mombasa", loanId: 203, disbursedDate: "2024-12-15", totalAmount: 30000 },
  { id: 4, clientName: "Winnie Oduor", phoneNumber: "0721098765", amountDue: 52000, dueDate: "2025-06-12", branch: "kisumu", loanId: 204, disbursedDate: "2024-12-12", totalAmount: 60000 },
  { id: 5, clientName: "Xavier Mwangi", phoneNumber: "0732109876", amountDue: 33000, dueDate: "2025-06-20", branch: "nakuru", loanId: 205, disbursedDate: "2024-12-20", totalAmount: 35000 },
  { id: 6, clientName: "Yvonne Njeri", phoneNumber: "0743210987", amountDue: 41000, dueDate: "2025-06-18", branch: "head-office", loanId: 206, disbursedDate: "2024-12-18", totalAmount: 45000 },
  { id: 7, clientName: "Zachary Omondi", phoneNumber: "0754321098", amountDue: 26000, dueDate: "2025-06-25", branch: "westlands", loanId: 207, disbursedDate: "2024-12-25", totalAmount: 30000 },
  { id: 8, clientName: "Alice Wairimu", phoneNumber: "0765432109", amountDue: 63000, dueDate: "2025-07-05", branch: "mombasa", loanId: 208, disbursedDate: "2025-01-05", totalAmount: 70000 },
  { id: 9, clientName: "Bernard Kipchoge", phoneNumber: "0776543210", amountDue: 39000, dueDate: "2025-07-10", branch: "kisumu", loanId: 209, disbursedDate: "2025-01-10", totalAmount: 42000 },
  { id: 10, clientName: "Christine Muthoni", phoneNumber: "0787654321", amountDue: 47000, dueDate: "2025-07-15", branch: "nakuru", loanId: 210, disbursedDate: "2025-01-15", totalAmount: 50000 },
  { id: 11, clientName: "Dennis Korir", phoneNumber: "0798765432", amountDue: 31000, dueDate: "2025-07-03", branch: "head-office", loanId: 211, disbursedDate: "2025-01-03", totalAmount: 35000 },
  { id: 12, clientName: "Elizabeth Akinyi", phoneNumber: "0709876543", amountDue: 56000, dueDate: "2025-07-08", branch: "westlands", loanId: 212, disbursedDate: "2025-01-08", totalAmount: 60000 },
  { id: 13, clientName: "Francis Njoroge", phoneNumber: "0721098765", amountDue: 25000, dueDate: "2025-08-12", branch: "mombasa", loanId: 213, disbursedDate: "2025-02-12", totalAmount: 28000 },
  { id: 14, clientName: "Grace Atieno", phoneNumber: "0732109876", amountDue: 72000, dueDate: "2025-08-18", branch: "kisumu", loanId: 214, disbursedDate: "2025-02-18", totalAmount: 80000 },
  { id: 15, clientName: "Henry Kiptoo", phoneNumber: "0743210987", amountDue: 29000, dueDate: "2025-08-22", branch: "nakuru", loanId: 215, disbursedDate: "2025-02-22", totalAmount: 32000 }
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
  { key: "loanId", header: "Loan ID" },
  { key: "totalAmount", header: "Total Amount (KES)" },
  { key: "disbursedDate", header: "Disbursed Date" },
  { key: "amountDue", header: "Amount Due (KES)" },
  { key: "dueDate", header: "Due Date" },
  { key: "branch", header: "Branch" }
];

// Helper function to group data by month
const groupByMonth = (data: typeof forecastingData) => {
  const grouped: Record<string, number> = {};
  
  data.forEach(loan => {
    const dueDate = new Date(loan.dueDate);
    const monthYear = format(dueDate, 'MMM yyyy');
    
    if (!grouped[monthYear]) {
      grouped[monthYear] = 0;
    }
    
    grouped[monthYear] += loan.amountDue;
  });
  
  return Object.entries(grouped)
    .sort((a, b) => {
      const dateA = new Date(a[0]);
      const dateB = new Date(b[0]);
      return dateA.getTime() - dateB.getTime();
    })
    .map(([month, amount]) => ({ month, amount }));
};

const ForecastingReport = () => {
  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(2025, 5, 1), // June 1, 2025
    to: new Date(2025, 7, 31), // August 31, 2025
  });
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Filter data based on selected branch, date range and search query
  const filteredLoans = forecastingData.filter(loan => {
    const matchesBranch = selectedBranch === "all" || loan.branch === selectedBranch;
    
    // Check if loan falls within selected date range
    const loanDate = new Date(loan.dueDate);
    const isInDateRange = (!date?.from || loanDate >= date.from) && 
                           (!date?.to || loanDate <= date.to);
    
    // Check if loan matches search query
    const matchesSearch = searchQuery === "" || 
                         loan.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         loan.phoneNumber.includes(searchQuery) ||
                         loan.loanId.toString().includes(searchQuery);
    
    return matchesBranch && isInDateRange && matchesSearch;
  });
  
  const totalAmountDue = filteredLoans.reduce((acc, loan) => acc + loan.amountDue, 0);
  const monthlyForecast = groupByMonth(filteredLoans);
  
  return (
    <ReportPage
      title="Forecasting Report"
      description="Forecast of future loan repayments"
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
              placeholder="Search by client name, phone or loan ID" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-auto flex-1"
            />
            
            <ExportButton 
              data={filteredLoans.map(loan => ({
                ...loan,
                branch: branches.find(b => b.value === loan.branch)?.label || loan.branch
              }))} 
              filename={`forecasting-report-${selectedBranch}-${format(new Date(), 'yyyy-MM-dd')}`} 
              columns={columns} 
            />
          </div>
          
          <div className="flex items-center justify-between bg-muted/50 p-2 rounded-md">
            <div className="text-sm">
              <span className="font-medium">{filteredLoans.length}</span> loans forecasted
            </div>
            <div className="text-sm font-medium">
              Total amount due: <span className="text-primary">KES {totalAmountDue.toLocaleString()}</span>
            </div>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium mb-2">Monthly Forecast</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {monthlyForecast.length > 0 ? (
              monthlyForecast.map((item, index) => (
                <Card key={index}>
                  <CardContent className="p-4">
                    <div className="text-muted-foreground">{item.month}</div>
                    <div className="text-2xl font-bold">KES {item.amount.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">Expected repayments</div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="col-span-3 text-center py-4 text-muted-foreground border rounded-md">
                No forecasting data available for the selected criteria
              </div>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-medium mb-2">Detailed Forecast</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client Name</TableHead>
                <TableHead>Phone Number</TableHead>
                <TableHead>Loan ID</TableHead>
                <TableHead>Total Amount</TableHead>
                <TableHead>Amount Due</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Branch</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLoans.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-4 text-muted-foreground">
                    No forecast data for the selected criteria
                  </TableCell>
                </TableRow>
              ) : (
                filteredLoans.map((loan) => (
                  <TableRow key={loan.id}>
                    <TableCell className="font-medium">{loan.clientName}</TableCell>
                    <TableCell>{loan.phoneNumber}</TableCell>
                    <TableCell>{loan.loanId}</TableCell>
                    <TableCell>KES {loan.totalAmount.toLocaleString()}</TableCell>
                    <TableCell>KES {loan.amountDue.toLocaleString()}</TableCell>
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
      </div>
    </ReportPage>
  );
};

export default ForecastingReport;
