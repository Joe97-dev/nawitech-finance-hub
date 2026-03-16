import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Search, RefreshCw, User, Banknote } from "lucide-react";

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
  const [step, setStep] = useState<"search" | "select-loan">("search");

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

  const selectClient = async (client: ClientResult) => {
    setSelectedClient(client);
    setStep("select-loan");
    setLoadingLoans(true);
    try {
      const { data, error } = await supabase
        .from("loans")
        .select("id, loan_number, amount, balance, status, type")
        .eq("client", client.id)
        .in("status", ["active", "in arrears"])
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

  const applyPayment = async () => {
    if (!transaction || !selectedClient || !selectedLoanId) return;
    setApplying(true);
    try {
      const { data, error } = await supabase.functions.invoke("apply-mpesa-payment", {
        body: {
          mpesaTransactionId: transaction.id,
          loanId: selectedLoanId,
          clientId: selectedClient.id,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to apply payment");

      toast({ title: "Payment matched", description: `${formatCurrency(transaction.trans_amount)} applied to loan successfully.` });
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
              <>Match <strong>{formatCurrency(transaction.trans_amount)}</strong> from {transaction.msisdn} (Ref: {transaction.bill_ref_number || "N/A"}) to a client's loan.</>
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

        {step === "select-loan" && selectedClient && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setStep("search"); setSelectedClient(null); setLoans([]); setSelectedLoanId(""); }}>
                ← Back
              </Button>
              <p className="text-sm font-medium">{selectedClient.first_name} {selectedClient.last_name} (ID: {selectedClient.id_number})</p>
            </div>

            {loadingLoans ? (
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
            <Button onClick={applyPayment} disabled={!selectedLoanId || applying}>
              {applying ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Applying...</> : "Apply Payment"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
