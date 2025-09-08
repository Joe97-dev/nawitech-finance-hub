
import { useState, useEffect } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Download, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Loan {
  id: string;
  loan_number: string;
  client: string;
  amount: number;
  balance: number;
  type: string;
  status: string;
  date: string;
  draw_down_balance: number;
}

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
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  
  useEffect(() => {
    const fetchLoans = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('loans')
          .select('*')
          .order('date', { ascending: false });
          
        if (error) throw error;
        
        // Transform data to match our Loan interface
        const formattedLoans: Loan[] = (data || []).map((loan: any) => ({
          id: loan.id,
          loan_number: loan.loan_number,
          client: loan.client,
          amount: loan.amount,
          balance: loan.balance,
          type: loan.type,
          status: loan.status,
          date: loan.date,
          draw_down_balance: loan.draw_down_balance || 0
        }));
        
        setLoans(formattedLoans);
      } catch (error: any) {
        console.error("Error fetching loans:", error);
        toast({
          variant: "destructive",
          title: "Failed to fetch loans",
          description: error.message || "An error occurred while fetching loans"
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchLoans();
  }, [toast]);
  
  const filteredLoans = loans.filter(loan => 
    loan.client.toLowerCase().includes(searchQuery.toLowerCase()) || 
    loan.loan_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    loan.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const exportLoans = () => {
    // Implement CSV export functionality here
    const headers = ["Loan ID", "Client", "Amount", "Balance", "Type", "Date", "Status"];
    const dataRows = filteredLoans.map(loan => [
      loan.loan_number || loan.id,
      loan.client,
      loan.amount.toString(),
      loan.balance.toString(),
      loan.type,
      loan.date,
      loan.status
    ]);
    
    // Create CSV content
    const csvContent = [
      headers.join(","),
      ...dataRows.map(row => row.join(","))
    ].join("\n");
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `loans-export-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Loans</h1>
            <p className="text-muted-foreground">Manage all client loans.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={exportLoans}>
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
                <TableHead>Draw Down</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    <div className="flex justify-center items-center">
                      <Loader2 className="h-6 w-6 animate-spin mr-2" />
                      <span>Loading loans...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredLoans.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    {searchQuery ? "No loans matching your search." : "No loans found."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredLoans.map((loan) => (
                  <TableRow key={loan.id}>
                    <TableCell>
                      <Link
                        to={`/loans/${loan.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {loan.loan_number || `${loan.id.substring(0, 8)}...`}
                      </Link>
                    </TableCell>
                    <TableCell>{loan.client}</TableCell>
                    <TableCell>{formatCurrency(loan.amount)}</TableCell>
                    <TableCell>{formatCurrency(loan.balance)}</TableCell>
                    <TableCell>
                      {loan.draw_down_balance > 0 ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          {formatCurrency(loan.draw_down_balance)}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>{loan.type}</TableCell>
                    <TableCell>{new Date(loan.date).toLocaleDateString()}</TableCell>
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
