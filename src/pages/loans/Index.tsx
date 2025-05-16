
import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Plus, Search, Download } from "lucide-react";
import { Link } from "react-router-dom";

// Sample loan data
const loans = [
  { id: "L0001", client: "Jane Cooper", amount: 50000, balance: 35000, type: "Business", status: "active", date: "2025-04-15" },
  { id: "L0002", client: "Wade Warren", amount: 30000, balance: 30000, type: "Personal", status: "pending", date: "2025-04-20" },
  { id: "L0003", client: "Esther Howard", amount: 75000, balance: 20000, type: "Business", status: "active", date: "2025-04-01" },
  { id: "L0004", client: "Cameron Williamson", amount: 25000, balance: 0, type: "Education", status: "closed", date: "2025-03-10" },
  { id: "L0005", client: "Brooklyn Simmons", amount: 100000, balance: 80000, type: "Business", status: "active", date: "2025-03-25" },
  { id: "L0006", client: "Leslie Alexander", amount: 15000, balance: 10000, type: "Personal", status: "active", date: "2025-04-05" },
  { id: "L0007", client: "Jenny Wilson", amount: 50000, balance: 50000, type: "Business", status: "pending", date: "2025-04-22" },
  { id: "L0008", client: "Guy Hawkins", amount: 35000, balance: 5000, type: "Personal", status: "active", date: "2025-03-15" },
];

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const getStatusClass = (status: string) => {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-800";
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    case "closed":
      return "bg-gray-100 text-gray-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

const LoansPage = () => {
  const [searchQuery, setSearchQuery] = useState("");
  
  const filteredLoans = loans.filter(loan => 
    loan.client.toLowerCase().includes(searchQuery.toLowerCase()) || 
    loan.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    loan.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Loans</h1>
            <p className="text-muted-foreground">Manage all client loans.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button asChild>
              <Link to="/loans/new">
                <Plus className="h-4 w-4 mr-2" />
                New Loan
              </Link>
            </Button>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search loans..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="outline">Filter</Button>
        </div>
        
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Loan ID</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLoans.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No loans found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredLoans.map((loan) => (
                  <TableRow key={loan.id}>
                    <TableCell>
                      <Link
                        to={`/loans/${loan.id}`}
                        className="font-medium text-nawitech-600 hover:underline"
                      >
                        {loan.id}
                      </Link>
                    </TableCell>
                    <TableCell>{loan.client}</TableCell>
                    <TableCell>{formatCurrency(loan.amount)}</TableCell>
                    <TableCell>{formatCurrency(loan.balance)}</TableCell>
                    <TableCell>{loan.type}</TableCell>
                    <TableCell>{loan.date}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${getStatusClass(loan.status)}`}
                      >
                        {loan.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/loans/${loan.id}`}>View</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default LoansPage;
