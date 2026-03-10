
import { useState, useEffect, useRef } from "react";
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
import { getOrganizationId } from "@/lib/get-organization-id";

// Define interface for clients
interface Client {
  id: string;
  first_name: string;
  last_name: string;
}

interface LoanOfficer {
  id: string;
  username: string;
  first_name: string | null;
  last_name: string | null;
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
  const [loadingClients, setLoadingClients] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const clientSearchRef = useRef<HTMLDivElement>(null);
  const [interestCalculation, setInterestCalculation] = useState<"monthly" | "annually">("annually");
  const [loanOfficers, setLoanOfficers] = useState<LoanOfficer[]>([]);
  const [selectedOfficerId, setSelectedOfficerId] = useState("");
  
  
  // Close client dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (clientSearchRef.current && !clientSearchRef.current.contains(e.target as Node)) {
        setShowClientDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Search clients from Supabase with debounce
  useEffect(() => {
    if (clientSearch.length < 2) {
      setClients([]);
      setShowClientDropdown(false);
      return;
    }

    const timeout = setTimeout(async () => {
      setLoadingClients(true);
      try {
        const { data, error } = await supabase
          .from('clients')
          .select('id, first_name, last_name')
          .or(`first_name.ilike.%${clientSearch}%,last_name.ilike.%${clientSearch}%,client_number.ilike.%${clientSearch}%,id_number.ilike.%${clientSearch}%,phone.ilike.%${clientSearch}%`)
          .limit(10);

        if (error) throw error;
        setClients(data || []);
        setShowClientDropdown((data || []).length > 0);
      } catch (error: any) {
        console.error("Error searching clients:", error);
      } finally {
        setLoadingClients(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [clientSearch]);

  // Fetch loan officers
  useEffect(() => {
    const fetchOfficers = async () => {
      try {
        const { data: roles } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'loan_officer');
        if (roles && roles.length > 0) {
          const userIds = roles.map(r => r.user_id);
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, username, first_name, last_name')
            .in('id', userIds);
          setLoanOfficers((profiles || []) as LoanOfficer[]);
        }
      } catch (error) {
        console.error("Error fetching officers:", error);
      }
    };
    fetchOfficers();
  }, []);
  
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
      
      const organizationId = await getOrganizationId();

      const loanData: any = {
        client: clientName,
        amount: amount,
        balance: totalAmountWithInterest,
        type: loanType,
        status: "pending",
        date: disbursementDate,
        frequency: repaymentFrequency,
        term_months: parseInt(loanTerm),
        interest_rate: parseFloat(interestRate),
        business_address: purpose || null,
        organization_id: organizationId,
      };
      
      if (selectedOfficerId) {
        loanData.loan_officer_id = selectedOfficerId;
      }
      
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
        description: "The loan has been created with pending status. Post a loan fee to activate.",
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
                  <div ref={clientSearchRef} className="relative">
                    <Input
                      placeholder="Search by name, ID, phone..."
                      value={clientSearch}
                      onChange={(e) => {
                        setClientSearch(e.target.value);
                        if (!e.target.value) {
                          setClientId("");
                        }
                      }}
                      onFocus={() => clients.length > 0 && setShowClientDropdown(true)}
                    />
                    {showClientDropdown && (
                      <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-md border bg-popover shadow-lg overflow-hidden max-h-[200px] overflow-y-auto">
                        {loadingClients ? (
                          <div className="flex items-center justify-center py-3">
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                          </div>
                        ) : (
                          <ul className="py-1">
                            {clients.map((client) => (
                              <li key={client.id}>
                                <button
                                  type="button"
                                  className="flex w-full items-center px-3 py-2 text-sm hover:bg-accent transition-colors text-left"
                                  onClick={() => {
                                    setClientId(client.id);
                                    setClientSearch(getFullClientName(client));
                                    setShowClientDropdown(false);
                                  }}
                                >
                                  {getFullClientName(client)}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="loanOfficer">Loan Officer</Label>
                  <Select
                    value={selectedOfficerId}
                    onValueChange={setSelectedOfficerId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select loan officer" />
                    </SelectTrigger>
                    <SelectContent>
                      {loanOfficers.length === 0 ? (
                        <SelectItem value="none" disabled>No officers found</SelectItem>
                      ) : (
                        loanOfficers.map((officer) => (
                          <SelectItem key={officer.id} value={officer.id}>
                            {officer.first_name && officer.last_name
                              ? `${officer.first_name} ${officer.last_name}`
                              : officer.username || officer.id.substring(0, 8)}
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
                    <Label>Business Address</Label>
                    <Textarea 
                      placeholder="Enter the client's business address and description"
                      className="min-h-[100px] resize-y"
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
