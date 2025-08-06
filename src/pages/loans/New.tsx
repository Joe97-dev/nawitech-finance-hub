
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
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { InterestCalculationToggle } from "@/components/reports/InterestCalculationToggle";
import { useRole } from "@/context/RoleContext";

// Define interface for clients
interface Client {
  id: string;
  first_name: string;
  last_name: string;
}

const NewLoanPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin, isLoanOfficer } = useRole();
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
  const [interestCalculation, setInterestCalculation] = useState<"monthly" | "annually">("annually");
  
  
  // Fetch clients from Supabase
  useEffect(() => {
    const fetchClients = async () => {
      try {
        setLoadingClients(true);
        
        // Get actual clients from Supabase
        const { data, error } = await supabase
          .from('clients')
          .select('id, first_name, last_name');
        
        if (error) {
          throw error;
        }
        
        // Set clients from database
        setClients(data || []);
        
      } catch (error: any) {
        console.error("Error fetching clients:", error);
        toast({
          variant: "destructive",
          title: "Failed to load clients",
          description: "There was an error loading the client list." + (error.message ? ` (${error.message})` : ""),
        });
      } finally {
        setLoadingClients(false);
      }
    };

    fetchClients();
  }, [toast]);
  
  const calculateTotal = () => {
    const amount = parseFloat(loanAmount) || 0;
    const rate = parseFloat(interestRate) || 0;
    const months = parseFloat(loanTerm) || 1;
    
    let totalInterest;
    if (interestCalculation === "monthly") {
      // Monthly interest: rate per month
      totalInterest = (amount * rate / 100) * months;
    } else {
      // Annual interest: rate per year, calculated for the loan term
      totalInterest = (amount * rate / 100) * (months / 12);
    }
    
    const totalAmount = amount + totalInterest;
    return totalAmount.toLocaleString('en-US');
  };
  
  const calculateMonthly = () => {
    const amount = parseFloat(loanAmount) || 0;
    const rate = parseFloat(interestRate) || 0;
    const months = parseFloat(loanTerm) || 1;
    
    let totalInterest;
    if (interestCalculation === "monthly") {
      // Monthly interest: rate per month
      totalInterest = (amount * rate / 100) * months;
    } else {
      // Annual interest: rate per year, calculated for the loan term
      totalInterest = (amount * rate / 100) * (months / 12);
    }
    
    const totalAmount = amount + totalInterest;
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
      if (!selectedClient) {
        throw new Error("Selected client not found");
      }
      
      const clientName = `${selectedClient.first_name} ${selectedClient.last_name}`;
      
      // Prepare loan data with pending status
      const amount = parseFloat(loanAmount);
      const rate = parseFloat(interestRate);
      const months = parseInt(loanTerm);
      
      // Calculate total amount with interest (this will be the initial balance)
      let totalInterest;
      if (interestCalculation === "monthly") {
        totalInterest = (amount * rate / 100) * months;
      } else {
        totalInterest = (amount * rate / 100) * (months / 12);
      }
      const totalAmountWithInterest = amount + totalInterest;
      
      const loanData = {
        client: clientName,
        amount: amount,
        balance: totalAmountWithInterest, // Set initial balance to include interest
        type: loanType,
        status: "pending",
        date: disbursementDate,
        frequency: repaymentFrequency,
        term_months: parseInt(loanTerm),
        interest_rate: parseFloat(interestRate)
      };
      
      console.log("Creating loan with data:", loanData);
      
      // Insert loan into Supabase
      const { data: loan, error } = await supabase
        .from('loans')
        .insert(loanData)
        .select()
        .single();
      
      if (error) throw error;
      
      // Generate loan schedule using the new database function
      if (loan) {
        await generateLoanSchedule(loan.id, amount, parseFloat(interestRate), parseInt(loanTerm), repaymentFrequency, disbursementDate);
      }
      
      toast({
        title: "Loan created",
        description: "The loan has been successfully created with pending status.",
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
  

  // Function to generate the loan repayment schedule using database function
  const generateLoanSchedule = async (
    loanId: string, 
    amount: number, 
    interestRate: number, 
    termMonths: number, 
    frequency: string, 
    startDate: string
  ) => {
    try {
      const { error } = await supabase.rpc('generate_loan_schedule', {
        p_loan_id: loanId,
        p_amount: amount,
        p_interest_rate: interestRate,
        p_term_months: termMonths,
        p_frequency: frequency,
        p_start_date: startDate
      });
      
      if (error) throw error;
    } catch (error) {
      console.error("Error generating loan schedule:", error);
      throw error;
    }
  };

  const getFullClientName = (client: Client) => {
    return `${client.first_name} ${client.last_name}`;
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
                      ) : clients.length === 0 ? (
                        <SelectItem value="no-clients" disabled>No clients found</SelectItem>
                      ) : (
                        clients.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {getFullClientName(client)}
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
                      <SelectItem value="Business">Business Loan</SelectItem>
                      <SelectItem value="Personal">Personal Loan</SelectItem>
                      <SelectItem value="Education">Education Loan</SelectItem>
                      <SelectItem value="Emergency">Emergency Loan</SelectItem>
                      <SelectItem value="Agricultural">Agricultural Loan</SelectItem>
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

                <InterestCalculationToggle
                  value={interestCalculation}
                  onChange={setInterestCalculation}
                />
                
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
            
            <div className="space-y-6">
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
                      <p className="text-lg font-medium">{interestRate}% {interestCalculation === "monthly" ? "per month" : "per annum"}</p>
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

            {/* Create Loan Button */}
            <Card>
              <CardFooter>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? "Creating Loan..." : "Create Loan"}
                </Button>
              </CardFooter>
            </Card>
            </div>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
};

export default NewLoanPage;
