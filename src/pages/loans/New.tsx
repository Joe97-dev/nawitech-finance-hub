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
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/context/RoleContext";
import { getOrganizationId } from "@/lib/get-organization-id";

interface Client {
  id: string;
  first_name: string;
  last_name: string;
}

interface LoanOfficer {
  id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
}

interface LoanProduct {
  id: string;
  name: string;
  interest_rate: number;
  interest_method: string;
  term_min: number;
  term_max: number;
  term_unit: string;
  amount_min: number;
  amount_max: number;
  description: string | null;
  status: string;
}

const NewLoanPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin, isLoanOfficer } = useRole();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loanAmount, setLoanAmount] = useState("");
  const [interestRate, setInterestRate] = useState("15");
  const [interestMethod, setInterestMethod] = useState<"flat" | "reducing">("flat");
  const [loanTerm, setLoanTerm] = useState("12");
  const [clientId, setClientId] = useState("");
  const [loanType, setLoanType] = useState("");
  const [disbursementDate, setDisbursementDate] = useState("");
  // Derive repayment frequency from product term_unit
  const getRepaymentFrequency = () => {
    const termUnit = selectedProduct?.term_unit || 'months';
    if (termUnit === 'days') return 'daily';
    if (termUnit === 'weeks') return 'weekly';
    return 'monthly';
  };
  const [purpose, setPurpose] = useState("");
  const [collateral, setCollateral] = useState("no");
  const [guarantor, setGuarantor] = useState("yes");
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [loadingClients, setLoadingClients] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const clientSearchRef = useRef<HTMLDivElement>(null);
  const [loanOfficers, setLoanOfficers] = useState<LoanOfficer[]>([]);
  const [selectedOfficerId, setSelectedOfficerId] = useState("");
  const [loanProducts, setLoanProducts] = useState<LoanProduct[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<LoanProduct | null>(null);

  // Fetch loan products
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const { data, error } = await supabase
          .from('loan_products')
          .select('*')
          .eq('status', 'active')
          .order('name');
        if (error) throw error;
        setLoanProducts(data as LoanProduct[] || []);
      } catch (error) {
        console.error("Error fetching loan products:", error);
      }
    };
    fetchProducts();
  }, []);

  // When a product is selected, auto-fill fields
  const handleProductSelect = (productId: string) => {
    setSelectedProductId(productId);
    const product = loanProducts.find(p => p.id === productId);
    if (product) {
      setSelectedProduct(product);
      setInterestRate(product.interest_rate.toString());
      setInterestMethod(product.interest_method as "flat" | "reducing");
      setLoanType(product.name);
      // Set term to min if min === max (strict product), otherwise keep user's choice
      if (product.term_min === product.term_max) {
        setLoanTerm(product.term_min.toString());
      }
    } else {
      setSelectedProduct(null);
    }
  };

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

  // Search clients
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
        const organizationId = await getOrganizationId();
        const { data: roles, error: rolesError } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'loan_officer');
        if (rolesError) throw rolesError;
        if (!roles || roles.length === 0) { setLoanOfficers([]); return; }
        const userIds = Array.from(new Set(roles.map((r) => r.user_id)));
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, username, first_name, last_name')
          .in('id', userIds)
          .eq('organization_id', organizationId);
        if (profilesError) throw profilesError;
        const sortedOfficers = [...(profiles || [])].sort((a, b) => {
          const aName = `${a.first_name || ''} ${a.last_name || ''}`.trim() || a.username || '';
          const bName = `${b.first_name || ''} ${b.last_name || ''}`.trim() || b.username || '';
          return aName.localeCompare(bName);
        });
        setLoanOfficers(sortedOfficers as LoanOfficer[]);
      } catch (error) {
        console.error("Error fetching officers:", error);
      }
    };
    fetchOfficers();
  }, []);
  
  const getNormalizedMonths = () => {
    const termValue = parseFloat(loanTerm) || 1;
    const termUnit = selectedProduct?.term_unit || 'months';
    if (termUnit === 'days') return termValue / 30;
    if (termUnit === 'weeks') return termValue / 4;
    return termValue;
  };

  const getInstallmentCount = () => {
    const months = getNormalizedMonths();
    const totalDays = Math.round(months * 30);

    switch (repaymentFrequency) {
      case 'daily': return totalDays;
      case 'weekly': return Math.max(1, Math.round(totalDays / 7));
      case 'bi-weekly': return Math.max(1, Math.round(totalDays / 14));
      case 'quarterly': return Math.max(1, Math.ceil(months / 3));
      default: return Math.max(1, Math.round(months)); // monthly
    }
  };

  const calculateTotal = () => {
    const amount = parseFloat(loanAmount) || 0;
    const rate = parseFloat(interestRate) || 0;
    const months = getNormalizedMonths();
    const installments = getInstallmentCount();
    
    if (interestMethod === "reducing") {
      const ratePerInstallment = (rate / 100) * months / installments;
      let remaining = amount;
      const principalPerInstallment = amount / installments;
      let total = 0;
      for (let i = 0; i < installments; i++) {
        total += principalPerInstallment + (remaining * ratePerInstallment);
        remaining -= principalPerInstallment;
      }
      return total.toLocaleString('en-US');
    } else {
      const totalInterest = amount * (rate / 100) * months;
      return (amount + totalInterest).toLocaleString('en-US');
    }
  };
  
  const calculateMonthly = () => {
    const amount = parseFloat(loanAmount) || 0;
    const rate = parseFloat(interestRate) || 0;
    const months = getNormalizedMonths();
    const installments = getInstallmentCount();
    
    if (interestMethod === "reducing") {
      const ratePerInstallment = (rate / 100) * months / installments;
      let remaining = amount;
      const principalPerInstallment = amount / installments;
      let total = 0;
      for (let i = 0; i < installments; i++) {
        total += principalPerInstallment + (remaining * ratePerInstallment);
        remaining -= principalPerInstallment;
      }
      return (total / installments).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else {
      const totalInterest = amount * (rate / 100) * months;
      const totalAmount = amount + totalInterest;
      return (totalAmount / installments).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
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

    // Validate against product constraints
    if (selectedProduct) {
      const amount = parseFloat(loanAmount);
      const term = parseInt(loanTerm);
      if (amount < selectedProduct.amount_min || amount > selectedProduct.amount_max) {
        toast({
          variant: "destructive",
          title: "Amount out of range",
          description: `Amount must be between ${selectedProduct.amount_min.toLocaleString()} and ${selectedProduct.amount_max.toLocaleString()} for this product.`,
        });
        return;
      }
      if (term < selectedProduct.term_min || term > selectedProduct.term_max) {
        toast({
          variant: "destructive",
          title: "Term out of range",
          description: `Term must be between ${selectedProduct.term_min} and ${selectedProduct.term_max} ${selectedProduct.term_unit} for this product.`,
        });
        return;
      }
    }
    
    setIsSubmitting(true);
    
    try {
      if (!selectedClient) {
        toast({ variant: "destructive", title: "Missing information", description: "Please select a client." });
        return;
      }
      
      const clientName = `${selectedClient.first_name} ${selectedClient.last_name}`;
      const amount = parseFloat(loanAmount);
      const rate = parseFloat(interestRate);
      const termValue = parseInt(loanTerm);
      
      // Convert term to months based on term_unit
      const termUnit = selectedProduct?.term_unit || 'months';
      let months: number;
      if (termUnit === 'days') {
        months = termValue / 30;
      } else if (termUnit === 'weeks') {
        months = termValue / 4;
      } else {
        months = termValue;
      }
      
      // Calculate initial balance
      let totalAmountWithInterest: number;
      if (interestMethod === "reducing") {
        const monthlyRate = rate / 100;
        let remaining = amount;
        const ppmt = amount / months;
        let total = 0;
        for (let i = 0; i < months; i++) {
          total += ppmt + (remaining * monthlyRate);
          remaining -= ppmt;
        }
        totalAmountWithInterest = total;
      } else {
        totalAmountWithInterest = amount + (amount * rate / 100) * months;
      }
      
      const organizationId = await getOrganizationId();

      const loanData: any = {
        client: clientName,
        amount,
        balance: totalAmountWithInterest,
        type: loanType,
        status: "pending",
        date: disbursementDate,
        frequency: repaymentFrequency,
        term_months: months,
        interest_rate: rate,
        interest_method: interestMethod,
        business_address: purpose || null,
        organization_id: organizationId,
      };
      
      if (selectedOfficerId) {
        loanData.loan_officer_id = selectedOfficerId;
      }
      
      const { data: loan, error } = await supabase
        .from('loans')
        .insert(loanData)
        .select()
        .single();
      
      if (error) throw error;
      
      if (loan) {
        await generateLoanSchedule(loan.id, amount, rate, months, repaymentFrequency, disbursementDate);
      }
      
      toast({
        title: "Loan created",
        description: "The loan has been created with pending status.",
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

  const generateLoanSchedule = async (
    loanId: string, amount: number, interestRate: number, 
    termMonths: number, frequency: string, startDate: string
  ) => {
    try {
      const { error } = await supabase.rpc('generate_loan_schedule', {
        p_loan_id: loanId, p_amount: amount, p_interest_rate: interestRate,
        p_term_months: termMonths, p_frequency: frequency, p_start_date: startDate
      });
      if (error) throw error;
    } catch (error) {
      console.error("Error generating loan schedule:", error);
      throw error;
    }
  };

  const getOfficerDisplayName = (officer: LoanOfficer) => {
    const fullName = [officer.first_name, officer.last_name].filter(Boolean).join(' ').trim();
    return fullName || officer.username || officer.id.substring(0, 8);
  };

  const getFullClientName = (client: Client) => `${client.first_name} ${client.last_name}`;
  
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center">
          <Button variant="ghost" size="sm" onClick={() => navigate("/loans")} className="mr-4">
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
                <CardDescription>Enter the loan amount and terms.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Loan Product Selector */}
                <div className="space-y-2">
                  <Label htmlFor="loanProduct">Loan Product</Label>
                  <Select value={selectedProductId} onValueChange={handleProductSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a loan product" />
                    </SelectTrigger>
                    <SelectContent>
                      {loanProducts.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} — {product.interest_rate}% ({product.interest_method === 'reducing' ? 'Reducing' : 'Flat'})
                        </SelectItem>
                      ))
                      }
                    </SelectContent>
                  </Select>
                  {selectedProduct && (
                    <div className="text-xs text-muted-foreground space-y-1 mt-1 p-2 rounded-md border bg-muted/50">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={
                          selectedProduct.interest_method === 'reducing' 
                            ? 'bg-blue-50 text-blue-700 border-blue-200' 
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }>
                          {selectedProduct.interest_method === 'reducing' ? 'Reducing Balance' : 'Flat Rate'}
                        </Badge>
                        <span>{selectedProduct.interest_rate}% interest</span>
                      </div>
                      <p>Amount: {selectedProduct.amount_min.toLocaleString()} – {selectedProduct.amount_max.toLocaleString()} KES</p>
                      <p>Term: {selectedProduct.term_min === selectedProduct.term_max 
                        ? `${selectedProduct.term_min} ${selectedProduct.term_unit}` 
                        : `${selectedProduct.term_min}–${selectedProduct.term_max} ${selectedProduct.term_unit}`}</p>
                      {selectedProduct.description && <p>{selectedProduct.description}</p>}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="client">Client</Label>
                  <div ref={clientSearchRef} className="relative">
                    <Input
                      placeholder="Search by name, ID, phone..."
                      value={clientSearch}
                      onChange={(e) => {
                        setClientSearch(e.target.value);
                        // Clear selection when user modifies search text
                        setClientId("");
                        setSelectedClient(null);
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
                                    setSelectedClient(client);
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
                  <Select value={selectedOfficerId} onValueChange={setSelectedOfficerId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select loan officer" />
                    </SelectTrigger>
                    <SelectContent>
                      {loanOfficers.length === 0 ? (
                        <SelectItem value="none" disabled>No officers found</SelectItem>
                      ) : (
                        loanOfficers.map((officer) => (
                          <SelectItem key={officer.id} value={officer.id}>
                            {getOfficerDisplayName(officer)}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="loanType">Loan Type</Label>
                  <Input
                    id="loanType"
                    value={loanType}
                    onChange={(e) => setLoanType(e.target.value)}
                    placeholder="e.g. Business Loan"
                    readOnly={!!selectedProduct}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="amount">Loan Amount (KES)</Label>
                  <Input 
                    id="amount" 
                    type="number" 
                    required 
                    value={loanAmount}
                    onChange={(e) => setLoanAmount(e.target.value)}
                    min={selectedProduct?.amount_min}
                    max={selectedProduct?.amount_max}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="interest">Interest Rate (%)</Label>
                    <Input 
                      id="interest" 
                      type="number" 
                      required 
                      value={interestRate}
                      onChange={(e) => setInterestRate(e.target.value)}
                      readOnly={!!selectedProduct}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Interest Method</Label>
                    <Select 
                      value={interestMethod} 
                      onValueChange={(v) => setInterestMethod(v as "flat" | "reducing")}
                      disabled={!!selectedProduct}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="flat">Flat Rate</SelectItem>
                        <SelectItem value="reducing">Reducing Balance</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="term">Loan Term ({selectedProduct?.term_unit || 'Months'})</Label>
                  <Input 
                    id="term" 
                    type="number" 
                    required 
                    value={loanTerm}
                    onChange={(e) => setLoanTerm(e.target.value)}
                    min={selectedProduct?.term_min}
                    max={selectedProduct?.term_max}
                    readOnly={selectedProduct ? selectedProduct.term_min === selectedProduct.term_max : false}
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
                  <RadioGroup value={repaymentFrequency} onValueChange={setRepaymentFrequency}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="weekly" id="weekly" />
                      <Label htmlFor="weekly">Weekly</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="bi-weekly" id="biweekly" />
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
                  <CardDescription>Review the loan details before approval.</CardDescription>
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
                        <p className="text-lg font-medium">{interestRate}% per month</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Interest Method</p>
                        <Badge variant="outline" className={
                          interestMethod === 'reducing' 
                            ? 'bg-blue-50 text-blue-700 border-blue-200' 
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }>
                          {interestMethod === 'reducing' ? 'Reducing Balance' : 'Flat Rate'}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Term</p>
                        <p className="text-lg font-medium">{loanTerm} {selectedProduct?.term_unit || 'Months'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Avg Monthly Payment</p>
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
                    <RadioGroup value={collateral} onValueChange={setCollateral}>
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
                    <RadioGroup value={guarantor} onValueChange={setGuarantor}>
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
