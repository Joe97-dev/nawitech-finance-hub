
import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/layout";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

// Define interface for clients
interface Client {
  id: string;
  name: string;
}

const NewLoanPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loanAmount, setLoanAmount] = useState("");
  const [interestRate, setInterestRate] = useState("15");
  const [loanTerm, setLoanTerm] = useState("12");
  const [clientId, setClientId] = useState("");
  const [loanType, setLoanType] = useState("");
  const [disbursementDate, setDisbursementDate] = useState("");
  const [repaymentFrequency, setRepaymentFrequency] = useState("monthly");
  const [purpose, setPurpose] = useState("");
  const [collateral, setCollateral] = useState("no");
  const [guarantor, setGuarantor] = useState("yes");
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  
  // Fetch clients from Supabase
  useEffect(() => {
    const fetchClients = async () => {
      try {
        // For now, we'll use the sample clients since we haven't set up the clients table
        // In a real application, you would fetch from the clients table
        setClients([
          { id: "1", name: "Jane Cooper" },
          { id: "2", name: "Wade Warren" },
          { id: "3", name: "Esther Howard" },
          { id: "4", name: "Cameron Williamson" },
          { id: "5", name: "Brooklyn Simmons" },
          { id: "6", name: "Leslie Alexander" },
          { id: "7", name: "Jenny Wilson" },
          { id: "8", name: "Guy Hawkins" },
        ]);
        setLoadingClients(false);
      } catch (error) {
        console.error("Error fetching clients:", error);
        toast({
          variant: "destructive",
          title: "Failed to load clients",
          description: "There was an error loading the client list.",
        });
        setLoadingClients(false);
      }
    };

    fetchClients();
  }, [toast]);
  
  const calculateTotal = () => {
    const amount = parseFloat(loanAmount) || 0;
    const rate = parseFloat(interestRate) || 0;
    const months = parseFloat(loanTerm) || 1;
    
    const totalInterest = (amount * rate / 100) * (months / 12);
    const totalAmount = amount + totalInterest;
    
    return totalAmount.toLocaleString('en-US');
  };
  
  const calculateMonthly = () => {
    const amount = parseFloat(loanAmount) || 0;
    const rate = parseFloat(interestRate) || 0;
    const months = parseFloat(loanTerm) || 1;
    
    const totalAmount = amount + (amount * rate / 100) * (months / 12);
    const monthlyPayment = totalAmount / months;
    
    return monthlyPayment.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!clientId || !loanType || !loanAmount || !disbursementDate) {
      toast({
        variant: "destructive",
        title: "Missing information",
        description: "Please fill in all required fields.",
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Get selected client name
      const selectedClient = clients.find(client => client.id === clientId);
      
      // Prepare loan data
      const amount = parseFloat(loanAmount);
      const loanData = {
        client: selectedClient?.name || "Unknown Client",
        amount: amount,
        balance: amount, // Initially, the balance is the full amount
        type: loanType,
        status: "pending",
        date: disbursementDate
      };
      
      // Insert loan into Supabase
      const { data: loan, error } = await supabase
        .from('loans')
        .insert(loanData)
        .select()
        .single();
      
      if (error) throw error;
      
      // Create loan schedule entries based on repayment frequency
      if (loan) {
        await createLoanSchedule(loan.id);
      }
      
      toast({
        title: "Loan created",
        description: "The loan has been successfully created.",
      });
      
      navigate("/loans");
    } catch (error: any) {
      console.error("Error creating loan:", error);
      toast({
        variant: "destructive",
        title: "Failed to create loan",
        description: error.message || "There was an error creating the loan.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Function to create the loan repayment schedule
  const createLoanSchedule = async (loanId: string) => {
    try {
      const amount = parseFloat(loanAmount);
      const rate = parseFloat(interestRate) / 100;
      const months = parseInt(loanTerm);
      
      // Calculate interest and principal per period
      const totalInterest = amount * rate * (months / 12);
      const totalAmount = amount + totalInterest;
      const installmentAmount = totalAmount / months;
      
      // Determine interval based on repayment frequency
      let intervalDays = 30; // Default for monthly
      if (repaymentFrequency === "weekly") {
        intervalDays = 7;
      } else if (repaymentFrequency === "biweekly") {
        intervalDays = 14;
      }
      
      // Create schedule entries
      const scheduleItems = [];
      const baseDate = new Date(disbursementDate);
      const interestPerInstallment = totalInterest / months;
      const principalPerInstallment = amount / months;
      
      for (let i = 0; i < months; i++) {
        // Calculate due date
        const dueDate = new Date(baseDate);
        dueDate.setDate(dueDate.getDate() + (i + 1) * intervalDays);
        
        // Create schedule item
        scheduleItems.push({
          loan_id: loanId,
          due_date: dueDate.toISOString().split('T')[0],
          principal_due: principalPerInstallment,
          interest_due: interestPerInstallment,
          total_due: installmentAmount,
          status: "pending"
        });
      }
      
      // Insert schedule items into database
      const { error } = await supabase
        .from('loan_schedule')
        .insert(scheduleItems);
      
      if (error) throw error;
    } catch (error) {
      console.error("Error creating loan schedule:", error);
      throw error;
    }
  };
  
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/loans")}
            className="mr-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">New Loan</h1>
            <p className="text-muted-foreground">Create a new loan for a client.</p>
          </div>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Loan Details</CardTitle>
                <CardDescription>
                  Enter the loan amount and terms.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="client">Client</Label>
                  <Select
                    value={clientId}
                    onValueChange={setClientId}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select client" />
                    </SelectTrigger>
                    <SelectContent>
                      {loadingClients ? (
                        <SelectItem value="loading" disabled>Loading clients...</SelectItem>
                      ) : (
                        clients.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="loanType">Loan Type</Label>
                  <Select
                    value={loanType}
                    onValueChange={setLoanType}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select loan type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="business">Business Loan</SelectItem>
                      <SelectItem value="personal">Personal Loan</SelectItem>
                      <SelectItem value="education">Education Loan</SelectItem>
                      <SelectItem value="emergency">Emergency Loan</SelectItem>
                      <SelectItem value="agricultural">Agricultural Loan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="amount">Loan Amount (KES)</Label>
                  <Input 
                    id="amount" 
                    type="number" 
                    required 
                    value={loanAmount}
                    onChange={(e) => setLoanAmount(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="interest">Interest Rate (%)</Label>
                  <Input 
                    id="interest" 
                    type="number" 
                    required 
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="term">Loan Term (Months)</Label>
                  <Input 
                    id="term" 
                    type="number" 
                    required 
                    value={loanTerm}
                    onChange={(e) => setLoanTerm(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="disbursementDate">Disbursement Date</Label>
                  <Input 
                    id="disbursementDate" 
                    type="date" 
                    required 
                    value={disbursementDate}
                    onChange={(e) => setDisbursementDate(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Repayment Frequency</Label>
                  <RadioGroup 
                    value={repaymentFrequency}
                    onValueChange={setRepaymentFrequency}
                    defaultValue="monthly"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="weekly" id="weekly" />
                      <Label htmlFor="weekly">Weekly</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="biweekly" id="biweekly" />
                      <Label htmlFor="biweekly">Bi-weekly</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="monthly" id="monthly" />
                      <Label htmlFor="monthly">Monthly</Label>
                    </div>
                  </RadioGroup>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Loan Summary</CardTitle>
                <CardDescription>
                  Review the loan details before approval.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Purpose of Loan</Label>
                  <Input 
                    placeholder="Brief description of loan purpose" 
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                  />
                </div>
                
                <div className="space-y-4 rounded-md border p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Principal Amount</p>
                      <p className="text-lg font-medium">KES {loanAmount ? parseFloat(loanAmount).toLocaleString('en-US') : '0'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Interest Rate</p>
                      <p className="text-lg font-medium">{interestRate}% p.a.</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Term</p>
                      <p className="text-lg font-medium">{loanTerm} Months</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Monthly Payment</p>
                      <p className="text-lg font-medium">KES {calculateMonthly()}</p>
                    </div>
                  </div>
                  <div className="border-t pt-4 mt-4">
                    <p className="text-sm text-muted-foreground">Total Repayment</p>
                    <p className="text-xl font-bold">KES {calculateTotal()}</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Collateral Required?</Label>
                  <RadioGroup 
                    value={collateral}
                    onValueChange={setCollateral}
                    defaultValue="no"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="yes" id="yes" />
                      <Label htmlFor="yes">Yes</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="no" id="no" />
                      <Label htmlFor="no">No</Label>
                    </div>
                  </RadioGroup>
                </div>
                
                <div className="space-y-2">
                  <Label>Guarantor Required?</Label>
                  <RadioGroup 
                    value={guarantor}
                    onValueChange={setGuarantor}
                    defaultValue="yes"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="yes" id="g-yes" />
                      <Label htmlFor="g-yes">Yes</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="no" id="g-no" />
                      <Label htmlFor="g-no">No</Label>
                    </div>
                  </RadioGroup>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <CardFooter className="flex justify-end pt-6">
            <Button
              variant="outline"
              onClick={() => navigate("/loans")}
              className="mr-2"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Loan"}
            </Button>
          </CardFooter>
        </form>
      </div>
    </DashboardLayout>
  );
};

export default NewLoanPage;
