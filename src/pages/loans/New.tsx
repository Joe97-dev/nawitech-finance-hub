
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
  
  // Disbursal workflow states
  const [workflowAction, setWorkflowAction] = useState<"request" | "approve" | "disburse">("request");
  const [requesterNotes, setRequesterNotes] = useState("");
  const [approvalNotes, setApprovalNotes] = useState("");
  const [disbursalNotes, setDisbursalNotes] = useState("");
  const [disbursalMethod, setDisbursalMethod] = useState<"bank_transfer" | "cash" | "mobile_money" | "cheque">("bank_transfer");
  const [disbursalReference, setDisbursalReference] = useState("");
  
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
    
    // Validate disbursal fields if disbursing
    if (workflowAction === "disburse" && (!disbursalMethod || !disbursalReference)) {
      toast({
        variant: "destructive",
        title: "Missing disbursal information",
        description: "Please fill in disbursal method and reference.",
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
      
      // Prepare loan data with status based on workflow action
      const amount = parseFloat(loanAmount);
      let loanStatus = "pending";
      if (workflowAction === "approve") loanStatus = "approved";
      if (workflowAction === "disburse") loanStatus = "active";
      
      const loanData = {
        client: clientName,
        amount: amount,
        balance: amount, // Initially, the balance is the full amount
        type: loanType,
        status: loanStatus,
        date: disbursementDate
      };
      
      console.log("Creating loan with data:", loanData);
      
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
        await createDisbursalRequest(loan.id);
      }
      
      let message = "The loan has been successfully created";
      if (workflowAction === "approve") message += " and approved";
      if (workflowAction === "disburse") message += " and disbursed";
      
      toast({
        title: "Loan processed",
        description: message + ".",
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
  
  // Function to create disbursal request
  const createDisbursalRequest = async (loanId: string) => {
    try {
      const amount = parseFloat(loanAmount);
      const currentUser = (await supabase.auth.getUser()).data.user;
      
      if (!currentUser) throw new Error("User not authenticated");
      
      const disbursalData: any = {
        loan_id: loanId,
        requested_amount: amount,
        requester_id: currentUser.id,
        requester_notes: requesterNotes || null,
        status: "pending_approval"
      };
      
      // If approving or disbursing immediately
      if (workflowAction === "approve" || workflowAction === "disburse") {
        disbursalData.status = "approved";
        disbursalData.approver_id = currentUser.id;
        disbursalData.approval_date = new Date().toISOString();
        disbursalData.approval_notes = approvalNotes || null;
      }
      
      // If disbursing immediately
      if (workflowAction === "disburse") {
        disbursalData.status = "disbursed";
        disbursalData.disburser_id = currentUser.id;
        disbursalData.disbursal_date = new Date().toISOString();
        disbursalData.disbursal_notes = disbursalNotes || null;
        disbursalData.actual_amount_disbursed = amount;
        disbursalData.disbursal_method = disbursalMethod;
        disbursalData.disbursal_reference = disbursalReference;
      }
      
      const { error } = await supabase
        .from('loan_disbursal_requests' as any)
        .insert(disbursalData);
      
      if (error) throw error;
    } catch (error) {
      console.error("Error creating disbursal request:", error);
      throw error;
    }
  };

  // Function to create the loan repayment schedule
  const createLoanSchedule = async (loanId: string) => {
    try {
      const amount = parseFloat(loanAmount);
      const rate = parseFloat(interestRate) / 100;
      const months = parseInt(loanTerm);
      
      // Calculate interest based on selected method
      let totalInterest;
      if (interestCalculation === "monthly") {
        // Monthly interest: rate per month
        totalInterest = amount * rate * months;
      } else {
        // Annual interest: rate per year, calculated for the loan term
        totalInterest = amount * rate * (months / 12);
      }
      
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
      
      console.log("Creating loan schedule with items:", scheduleItems);
      
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

            {/* Workflow Actions Card */}
            {(isAdmin || isLoanOfficer) && (
              <Card>
                <CardHeader>
                  <CardTitle>Workflow Action</CardTitle>
                  <CardDescription>
                    Choose what action to take with this loan.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Action</Label>
                    <RadioGroup 
                      value={workflowAction}
                      onValueChange={(value: "request" | "approve" | "disburse") => setWorkflowAction(value)}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="request" id="request" />
                        <Label htmlFor="request">Request Approval</Label>
                      </div>
                      {isLoanOfficer && (
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="approve" id="approve" />
                          <Label htmlFor="approve">Approve & Request Disbursal</Label>
                        </div>
                      )}
                      {isAdmin && (
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="disburse" id="disburse" />
                          <Label htmlFor="disburse">Approve & Disburse Immediately</Label>
                        </div>
                      )}
                    </RadioGroup>
                  </div>

                  <div className="space-y-2">
                    <Label>Request Notes</Label>
                    <Textarea 
                      placeholder="Additional notes for the request" 
                      value={requesterNotes}
                      onChange={(e) => setRequesterNotes(e.target.value)}
                    />
                  </div>

                  {(workflowAction === "approve" || workflowAction === "disburse") && (
                    <div className="space-y-2">
                      <Label>Approval Notes</Label>
                      <Textarea 
                        placeholder="Notes for approval" 
                        value={approvalNotes}
                        onChange={(e) => setApprovalNotes(e.target.value)}
                      />
                    </div>
                  )}

                  {workflowAction === "disburse" && (
                    <>
                      <div className="space-y-2">
                        <Label>Disbursal Method</Label>
                        <Select
                          value={disbursalMethod}
                          onValueChange={(value: "bank_transfer" | "cash" | "mobile_money" | "cheque") => setDisbursalMethod(value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select disbursal method" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                            <SelectItem value="cash">Cash</SelectItem>
                            <SelectItem value="mobile_money">Mobile Money</SelectItem>
                            <SelectItem value="cheque">Cheque</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Disbursal Reference</Label>
                        <Input 
                          placeholder="Transaction reference/receipt number" 
                          value={disbursalReference}
                          onChange={(e) => setDisbursalReference(e.target.value)}
                          required={workflowAction === "disburse"}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Disbursal Notes</Label>
                        <Textarea 
                          placeholder="Notes for disbursal" 
                          value={disbursalNotes}
                          onChange={(e) => setDisbursalNotes(e.target.value)}
                        />
                      </div>
                    </>
                  )}
                </CardContent>
                <CardFooter>
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? "Processing..." : 
                     workflowAction === "request" ? "Create & Request Approval" :
                     workflowAction === "approve" ? "Create & Approve" : 
                     "Create & Disburse"}
                  </Button>
                </CardFooter>
              </Card>
            )}

            {/* Simple create button for data entry users */}
            {!isAdmin && !isLoanOfficer && (
              <Card>
                <CardFooter>
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? "Creating Loan..." : "Create Loan"}
                  </Button>
                </CardFooter>
              </Card>
            )}
            </div>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
};

export default NewLoanPage;
