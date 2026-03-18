import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Search, RefreshCw, User, Banknote, Receipt } from "lucide-react";

interface MpesaTransaction {
  id: string;
  trans_id: string;
  trans_amount: number;
  msisdn: string;
  bill_ref_number: string | null;
  first_name: string | null;
  last_name: string | null;
}

interface ClientResult {
  id: string;
  first_name: string;
  last_name: string;
  id_number: string;
  phone: string;
}

interface LoanResult {
  id: string;
  loan_number: string | null;
  amount: number;
  balance: number;
  status: string;
  type: string;
}

type MatchType = "repayment" | "loan_fee" | "client_fee";

const loanFeeTypes = [
  { value: "processing_fee", label: "Processing Fee" },
  { value: "administration_fee", label: "Administration Fee" },
  { value: "late_fee", label: "Late Payment Fee" },
  { value: "penalty_fee", label: "Penalty Fee" },
  { value: "appraisal_fee", label: "Appraisal Fee" },
  { value: "legal_fee", label: "Legal Fee" },
  { value: "insurance_fee", label: "Insurance Fee" },
  { value: "other_fee", label: "Other Fee" },
];

const clientFeeTypes = [
  { value: "registration_fee", label: "Registration Fee" },
  { value: "membership_fee", label: "Membership Fee" },
  { value: "documentation_fee", label: "Documentation Fee" },
  { value: "account_maintenance_fee", label: "Account Maintenance Fee" },
  { value: "kyc_fee", label: "KYC Processing Fee" },
  { value: "card_issuance_fee", label: "Card Issuance Fee" },
  { value: "transaction_fee", label: "Transaction Fee" },
  { value: "other_fee", label: "Other Fee" },
];

interface ManualMatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: MpesaTransaction | null;
  onMatched: () => void;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "KES", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

export function ManualMatchDialog({ open, onOpenChange, transaction, onMatched }: ManualMatchDialogProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [clients, setClients] = useState<ClientResult[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientResult | null>(null);
  const [loans, setLoans] = useState<LoanResult[]>([]);
  const [selectedLoanId, setSelectedLoanId] = useState<string>("");
  const [searching, setSearching] = useState(false);
  const [loadingLoans, setLoadingLoans] = useState(false);
  const [applying, setApplying] = useState(false);
  const [step, setStep] = useState<"search" | "select-type" | "select-loan">("search");
  const [matchType, setMatchType] = useState<MatchType>("repayment");
  const [feeType, setFeeType] = useState<string>("");

  useEffect(() => {
    if (open && transaction?.bill_ref_number) {
      setSearchQuery(transaction.bill_ref_number);
    }
    if (!open) {
      setSearchQuery("");
      setClients([]);
      setSelectedClient(null);
      setLoans([]);
      setSelectedLoanId("");
      setStep("search");
      setMatchType("repayment");
      setFeeType("");
    }
  }, [open, transaction]);

  const searchClients = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const q = searchQuery.trim();
      const { data, error } = await supabase
        .from("clients")
        .select("id, first_name, last_name, id_number, phone")
        .or(`id_number.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%,phone.ilike.%${q}%`)
        .limit(10);

      if (error) throw error;
      setClients(data || []);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Search failed", description: err.message });
    } finally {
      setSearching(false);
    }
  };

  const selectClient = (client: ClientResult) => {
    setSelectedClient(client);
    setStep("select-type");
  };

  const proceedToLoanSelection = async () => {
    if (!selectedClient) return;
    setStep("select-loan");
    setLoadingLoans(true);
    try {
      const clientName = `${selectedClient.first_name} ${selectedClient.last_name}`;
      
      if (matchType === "client_fee") {
        // For client fees, we don't need to select a loan — we use the client_fee_account
        setLoadingLoans(false);
        return;
      }

      const statusFilter = matchType === "loan_fee" 
        ? ["active", "in arrears", "pending"] 
        : ["active", "in arrears"];

      const { data, error } = await supabase
        .from("loans")
        .select("id, loan_number, amount, balance, status, type")
        .eq("client", clientName)
        .in("status", statusFilter)
        .neq("type", "client_fee_account")
        .order("date", { ascending: true });

      if (error) throw error;
      setLoans(data || []);
      if (data && data.length === 1) {
        setSelectedLoanId(data[0].id);
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to load loans", description: err.message });
    } finally {
      setLoadingLoans(false);
    }
  };

  const canApply = () => {
    if (matchType === "client_fee") return !!feeType;
    if (matchType === "loan_fee") return !!selectedLoanId && !!feeType;
    return !!selectedLoanId; // repayment
  };

  const applyPayment = async () => {
    if (!transaction || !selectedClient) return;
    setApplying(true);
    try {
      const { data, error } = await supabase.functions.invoke("apply-mpesa-payment", {
        body: {
          mpesaTransactionId: transaction.id,
          loanId: matchType === "client_fee" ? null : selectedLoanId,
          clientId: selectedClient.id,
          matchType,
          feeType: matchType !== "repayment" ? feeType : undefined,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to apply payment");

      const typeLabel = matchType === "repayment" ? "repayment" : matchType === "loan_fee" ? "loan fee" : "client fee";
      toast({ title: "Payment matched", description: `${formatCurrency(transaction.trans_amount)} applied as ${typeLabel} successfully.` });
      onOpenChange(false);
      onMatched();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to apply payment", description: err.message });
    } finally {
      setApplying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Match M-Pesa Payment</DialogTitle>
          <DialogDescription>
            {transaction && (
              <>Match <strong>{formatCurrency(transaction.trans_amount)}</strong> from {transaction.msisdn} (Ref: {transaction.bill_ref_number || "N/A"}) to a client.</>
            )}
          </DialogDescription>
        </DialogHeader>

        {step === "search" && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="client-search">Search client by name, ID number, or phone</Label>
                <Input
                  id="client-search"
                  placeholder="Enter name, ID, or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchClients()}
                />
              </div>
              <Button onClick={searchClients} disabled={searching} className="mt-auto" size="icon" variant="outline">
                {searching ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>

            {clients.length > 0 && (
              <div className="border rounded-lg divide-y max-h-60 overflow-auto">
                {clients.map((client) => (
                  <button
                    key={client.id}
                    className="w-full text-left px-4 py-3 hover:bg-accent transition-colors flex items-center gap-3"
                    onClick={() => selectClient(client)}
                  >
                    <User className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{client.first_name} {client.last_name}</p>
                      <p className="text-sm text-muted-foreground">ID: {client.id_number} • {client.phone}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {clients.length === 0 && searchQuery && !searching && (
              <p className="text-sm text-muted-foreground text-center py-4">No clients found. Try a different search.</p>
            )}
          </div>
        )}

        {step === "select-type" && selectedClient && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setStep("search"); setSelectedClient(null); setMatchType("repayment"); setFeeType(""); }}>
                ← Back
              </Button>
              <p className="text-sm font-medium">{selectedClient.first_name} {selectedClient.last_name} (ID: {selectedClient.id_number})</p>
            </div>

            <div>
              <Label className="text-sm font-medium mb-2 block">Match payment as:</Label>
              <RadioGroup value={matchType} onValueChange={(v) => { setMatchType(v as MatchType); setFeeType(""); }} className="space-y-2">
                <label className={`flex items-center gap-3 border rounded-lg px-4 py-3 cursor-pointer transition-colors ${matchType === "repayment" ? "border-primary bg-primary/5" : "hover:bg-accent"}`}>
                  <RadioGroupItem value="repayment" />
                  <Banknote className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="font-medium">Loan Repayment</p>
                    <p className="text-sm text-muted-foreground">Apply as a repayment to a loan</p>
                  </div>
                </label>
                <label className={`flex items-center gap-3 border rounded-lg px-4 py-3 cursor-pointer transition-colors ${matchType === "loan_fee" ? "border-primary bg-primary/5" : "hover:bg-accent"}`}>
                  <RadioGroupItem value="loan_fee" />
                  <Receipt className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="font-medium">Loan Fee</p>
                    <p className="text-sm text-muted-foreground">Record as a fee on a specific loan</p>
                  </div>
                </label>
                <label className={`flex items-center gap-3 border rounded-lg px-4 py-3 cursor-pointer transition-colors ${matchType === "client_fee" ? "border-primary bg-primary/5" : "hover:bg-accent"}`}>
                  <RadioGroupItem value="client_fee" />
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="font-medium">Client Fee</p>
                    <p className="text-sm text-muted-foreground">Record as a client-level fee (registration, KYC, etc.)</p>
                  </div>
                </label>
              </RadioGroup>
            </div>

            {(matchType === "loan_fee" || matchType === "client_fee") && (
              <div>
                <Label className="text-sm font-medium mb-2 block">Fee Type</Label>
                <Select value={feeType} onValueChange={setFeeType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select fee type" />
                  </SelectTrigger>
                  <SelectContent>
                    {(matchType === "loan_fee" ? loanFeeTypes : clientFeeTypes).map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button
              className="w-full"
              onClick={() => {
                if (matchType === "client_fee") {
                  // Skip loan selection for client fees
                  setStep("select-loan");
                } else {
                  proceedToLoanSelection();
                }
              }}
              disabled={matchType !== "repayment" && !feeType}
            >
              {matchType === "client_fee" ? "Continue" : "Select Loan →"}
            </Button>
          </div>
        )}

        {step === "select-loan" && selectedClient && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setStep("select-type"); setLoans([]); setSelectedLoanId(""); }}>
                ← Back
              </Button>
              <p className="text-sm font-medium">{selectedClient.first_name} {selectedClient.last_name}</p>
              <Badge variant="outline" className="text-xs">
                {matchType === "repayment" ? "Repayment" : matchType === "loan_fee" ? "Loan Fee" : "Client Fee"}
              </Badge>
            </div>

            {matchType === "client_fee" ? (
              <div className="border rounded-lg p-4 bg-muted/50 text-center space-y-1">
                <Receipt className="h-8 w-8 mx-auto text-muted-foreground" />
                <p className="font-medium">Client Fee: {clientFeeTypes.find(f => f.value === feeType)?.label}</p>
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(transaction?.trans_amount || 0)} will be recorded as a client fee for {selectedClient.first_name} {selectedClient.last_name}.
                </p>
              </div>
            ) : loadingLoans ? (
              <div className="text-center py-4 text-muted-foreground">Loading loans...</div>
            ) : loans.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">No active loans found for this client.</div>
            ) : (
              <RadioGroup value={selectedLoanId} onValueChange={setSelectedLoanId} className="space-y-2">
                {loans.map((loan) => (
                  <label
                    key={loan.id}
                    className={`flex items-center gap-3 border rounded-lg px-4 py-3 cursor-pointer transition-colors ${selectedLoanId === loan.id ? "border-primary bg-primary/5" : "hover:bg-accent"}`}
                  >
                    <RadioGroupItem value={loan.id} />
                    <Banknote className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{loan.loan_number || "—"}</span>
                        <Badge variant={loan.status === "active" ? "default" : "destructive"} className="text-xs">
                          {loan.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {loan.type} • Amount: {formatCurrency(loan.amount)} • Balance: {formatCurrency(loan.balance)}
                      </p>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          {step === "select-loan" && (
            <Button onClick={applyPayment} disabled={!canApply() || applying}>
              {applying ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Applying...</> : 
                matchType === "repayment" ? "Apply Payment" : "Apply Fee"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
