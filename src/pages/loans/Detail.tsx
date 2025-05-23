
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/layout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CreditCard, FileText, Calendar } from "lucide-react";
import { LoanRepaymentSchedule } from "@/components/loans/LoanRepaymentSchedule";
import { LoanTransactions } from "@/components/loans/LoanTransactions";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface LoanData {
  id: string;
  client: string;
  amount: number;
  balance: number;
  type: string;
  status: string;
  date: string;
  created_at: string | null;
  updated_at: string | null;
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

const LoanDetailPage = () => {
  const { loanId } = useParams<{ loanId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loan, setLoan] = useState<LoanData | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchLoanDetails = async () => {
      if (!loanId) return;
      
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('loans')
          .select('*')
          .eq('id', loanId)
          .single();
        
        if (error) throw error;
        
        if (data) {
          setLoan(data as LoanData);
        }
      } catch (error: any) {
        console.error("Error fetching loan details:", error);
        toast({
          variant: "destructive",
          title: "Failed to fetch loan details",
          description: error.message || "An error occurred."
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchLoanDetails();
  }, [loanId, toast]);
  
  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            <p>Loading loan details...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }
  
  if (!loan) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
          <h2 className="text-2xl font-bold">Loan Not Found</h2>
          <p className="text-muted-foreground">The loan you're looking for doesn't exist or has been removed.</p>
          <Button onClick={() => navigate("/loans")}>Go Back to Loans</Button>
        </div>
      </DashboardLayout>
    );
  }
  
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/loans")}
              className="mr-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Loans
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Loan #{loan.id.substring(0, 8)}</h1>
              <p className="text-muted-foreground">Client: {loan.client}</p>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle>Loan Information</CardTitle>
              <CardDescription>Loan details and status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="font-medium text-lg">{loan.type} Loan</h3>
                <Badge className={getStatusClass(loan.status)}>
                  {loan.status}
                </Badge>
              </div>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Amount</p>
                  <p className="text-2xl font-semibold">{formatCurrency(loan.amount)}</p>
                </div>
                
                <div>
                  <p className="text-sm text-muted-foreground">Outstanding Balance</p>
                  <p className="text-2xl font-semibold">{formatCurrency(loan.balance)}</p>
                </div>
                
                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Disbursed Date</span>
                    <span className="font-medium">{format(new Date(loan.date), "PPP")}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Created</span>
                    <span className="font-medium">{loan.created_at ? format(new Date(loan.created_at), "PPP") : "—"}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="md:col-span-2">
            <CardContent className="p-0">
              <Tabs defaultValue="schedule" className="w-full">
                <TabsList className="w-full grid grid-cols-2">
                  <TabsTrigger value="schedule">
                    <Calendar className="h-4 w-4 mr-2" />
                    Repayment Schedule
                  </TabsTrigger>
                  <TabsTrigger value="transactions">
                    <CreditCard className="h-4 w-4 mr-2" />
                    Transactions
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="schedule" className="p-4">
                  <LoanRepaymentSchedule loanId={loanId || ""} />
                </TabsContent>
                
                <TabsContent value="transactions" className="p-4">
                  <LoanTransactions loanId={loanId || ""} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default LoanDetailPage;
