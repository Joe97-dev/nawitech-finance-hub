import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/dashboard/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ArrowRight, Loader2, ArrowLeftRight, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getOrganizationId } from "@/lib/get-organization-id";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/context/RoleContext";
import { useNavigate } from "react-router-dom";

interface ClientOption {
  id: string;
  first_name: string;
  last_name: string;
  client_number: string | null;
  account_balance: number;
  account_id: string | null;
}

interface LoanOption {
  id: string;
  loan_number: string | null;
  type: string;
  balance: number;
  status: string;
}

interface TransferRecord {
  id: string;
  created_at: string;
  amount: number;
  notes: string | null;
  transaction_type: string;
  new_balance: number;
  previous_balance: number;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

const FundTransfers = () => {
  const { toast } = useToast();
  const { isAdmin } = useRole();
  const navigate = useNavigate();

  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [sourceClientId, setSourceClientId] = useState("");
  const [sourceSearch, setSourceSearch] = useState("");
  const [destSearch, setDestSearch] = useState("");

  const [transferType, setTransferType] = useState<"loan" | "account">("loan");
  const [destClientId, setDestClientId] = useState("");
  const [destLoans, setDestLoans] = useState<LoanOption[]>([]);
  const [destLoanId, setDestLoanId] = useState("");
  const [loadingLoans, setLoadingLoans] = useState(false);

  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [processing, setProcessing] = useState(false);

  const [recentTransfers, setRecentTransfers] = useState<TransferRecord[]>([]);

  useEffect(() => {
    if (!isAdmin) {
      navigate("/");
      return;
    }
    fetchClients();
  }, [isAdmin]);

  const fetchClients = async () => {
    setLoadingClients(true);
    try {
      const { data: clientsData, error } = await supabase
        .from("clients")
        .select("id, first_name, last_name, client_number")
        .order("first_name");

      if (error) throw error;

      // Fetch accounts for all clients
      const { data: accounts } = await supabase
        .from("client_accounts")
        .select("id, client_id, balance");

      const accountMap = new Map(
        (accounts || []).map((a) => [a.client_id, { id: a.id, balance: a.balance }])
      );

      const mapped: ClientOption[] = (clientsData || []).map((c) => {
        const account = accountMap.get(c.id);
        return {
          ...c,
          account_balance: account?.balance || 0,
          account_id: account?.id || null,
        };
      });

      setClients(mapped);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setLoadingClients(false);
    }
  };

  // Fetch destination client's loans
  const fetchDestLoans = useCallback(async (clientId: string) => {
    if (!clientId) {
      setDestLoans([]);
      return;
    }
    setLoadingLoans(true);
    try {
      const client = clients.find((c) => c.id === clientId);
      if (!client) return;

      const clientName = `${client.first_name} ${client.last_name}`;
      const { data, error } = await supabase
        .from("loans")
        .select("id, loan_number, type, balance, status")
        .eq("client", clientName)
        .in("status", ["active", "in arrears"])
        .neq("type", "client_fee_account")
        .order("date", { ascending: false });

      if (error) throw error;
      setDestLoans((data || []) as LoanOption[]);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setLoadingLoans(false);
    }
  }, [clients, toast]);

  useEffect(() => {
    if (transferType === "loan" && destClientId) {
      fetchDestLoans(destClientId);
    }
  }, [destClientId, transferType, fetchDestLoans]);

  const sourceClient = clients.find((c) => c.id === sourceClientId);
  const destClient = clients.find((c) => c.id === destClientId);

  const filteredSourceClients = clients.filter((c) => {
    if (!sourceSearch) return true;
    const search = sourceSearch.toLowerCase();
    return (
      `${c.first_name} ${c.last_name}`.toLowerCase().includes(search) ||
      (c.client_number || "").toLowerCase().includes(search)
    );
  });

  const filteredDestClients = clients.filter((c) => {
    if (!destSearch) return true;
    const search = destSearch.toLowerCase();
    return (
      `${c.first_name} ${c.last_name}`.toLowerCase().includes(search) ||
      (c.client_number || "").toLowerCase().includes(search)
    );
  });

  const handleTransfer = async () => {
    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      toast({ variant: "destructive", title: "Error", description: "Enter a valid amount." });
      return;
    }
    if (!sourceClient) {
      toast({ variant: "destructive", title: "Error", description: "Select a source client." });
      return;
    }
    if (transferAmount > sourceClient.account_balance) {
      toast({ variant: "destructive", title: "Error", description: "Insufficient balance in source client's account." });
      return;
    }
    if (!destClient) {
      toast({ variant: "destructive", title: "Error", description: "Select a destination client." });
      return;
    }
    if (transferType === "loan" && !destLoanId) {
      toast({ variant: "destructive", title: "Error", description: "Select a destination loan." });
      return;
    }

    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const organizationId = await getOrganizationId();
      const sourceAccountId = sourceClient.account_id;
      if (!sourceAccountId) throw new Error("Source client has no account");

      const sourceName = `${sourceClient.first_name} ${sourceClient.last_name}`;
      const destName = `${destClient.first_name} ${destClient.last_name}`;

      // Step 1: Withdraw from source client's account
      const newSourceBalance = sourceClient.account_balance - transferAmount;
      const { error: withdrawErr } = await supabase
        .from("client_account_transactions")
        .insert({
          client_account_id: sourceAccountId,
          amount: -transferAmount,
          transaction_type: "withdrawal",
          notes: transferType === "loan"
            ? `Transfer to ${destName}'s loan${notes ? ` - ${notes}` : ""}`
            : `Transfer to ${destName}'s account${notes ? ` - ${notes}` : ""}`,
          created_by: user.id,
          previous_balance: sourceClient.account_balance,
          new_balance: newSourceBalance,
          organization_id: organizationId,
        });
      if (withdrawErr) throw withdrawErr;

      if (transferType === "loan") {
        // Step 2a: Create repayment transaction on destination loan
        const { error: loanTxErr } = await supabase
          .from("loan_transactions")
          .insert({
            loan_id: destLoanId,
            amount: transferAmount,
            transaction_type: "repayment",
            payment_method: "draw_down_account",
            receipt_number: `TRF-${Date.now()}`,
            notes: `Transfer from ${sourceName}'s Draw Down Account${notes ? ` - ${notes}` : ""}`,
            created_by: user.id,
            organization_id: organizationId,
          });
        if (loanTxErr) throw loanTxErr;

        // Step 2b: Allocate payment to schedule
        await allocatePaymentToSchedule(destLoanId, transferAmount);

        // Step 2c: Recalculate loan balance
        const { data: balanceResult } = await supabase.rpc("calculate_outstanding_balance", {
          p_loan_id: destLoanId,
        });
        if (balanceResult !== null) {
          await supabase.from("loans").update({ balance: balanceResult }).eq("id", destLoanId);
          await supabase.rpc("update_loan_status", { p_loan_id: destLoanId });
        }
      } else {
        // Step 2a: Deposit to destination client's account
        let destAccountId = destClient.account_id;
        let destBalance = destClient.account_balance;

        if (!destAccountId) {
          const { data: newAcc, error: accErr } = await supabase
            .from("client_accounts")
            .insert({ client_id: destClientId, balance: 0, organization_id: organizationId })
            .select()
            .single();
          if (accErr) throw accErr;
          destAccountId = newAcc.id;
          destBalance = 0;
        }

        const { error: depositErr } = await supabase
          .from("client_account_transactions")
          .insert({
            client_account_id: destAccountId,
            amount: transferAmount,
            transaction_type: "deposit",
            notes: `Transfer from ${sourceName}'s Draw Down Account${notes ? ` - ${notes}` : ""}`,
            created_by: user.id,
            previous_balance: destBalance,
            new_balance: destBalance + transferAmount,
            organization_id: organizationId,
          });
        if (depositErr) throw depositErr;
      }

      toast({
        title: "Transfer Successful",
        description: `${formatCurrency(transferAmount)} transferred from ${sourceName} to ${destName}${transferType === "loan" ? "'s loan" : "'s account"}.`,
      });

      // Reset form
      setAmount("");
      setNotes("");
      setSourceClientId("");
      setDestClientId("");
      setDestLoanId("");
      fetchClients();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Transfer Failed", description: err.message });
    } finally {
      setProcessing(false);
    }
  };

  const allocatePaymentToSchedule = async (loanId: string, paymentAmount: number) => {
    const { data: scheduleItems, error } = await supabase
      .from("loan_schedule")
      .select("*")
      .eq("loan_id", loanId)
      .neq("status", "paid")
      .order("due_date", { ascending: true });

    if (error) throw error;

    let remaining = paymentAmount;
    for (const item of scheduleItems || []) {
      if (remaining <= 0) break;
      const outstanding = item.total_due - (item.amount_paid || 0);
      const allocation = Math.min(remaining, outstanding);
      const newPaid = (item.amount_paid || 0) + allocation;
      const newStatus = newPaid >= item.total_due ? "paid" : newPaid > 0 ? "partial" : "pending";

      await supabase
        .from("loan_schedule")
        .update({ amount_paid: newPaid, status: newStatus })
        .eq("id", item.id);

      remaining -= allocation;
    }
  };

  if (loadingClients) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fund Transfers</h1>
          <p className="text-muted-foreground">
            Transfer funds between client accounts or pay another client's loan.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5" />
              New Transfer
            </CardTitle>
            <CardDescription>
              Withdraw from one client's Draw Down Account and transfer to another client's loan or account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Source Client */}
              <div className="space-y-4 p-4 border rounded-lg">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                  Source (Withdraw From)
                </h3>
                <div className="space-y-2">
                  <Label>Search Client</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      placeholder="Search by name or number..."
                      value={sourceSearch}
                      onChange={(e) => setSourceSearch(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Select Client</Label>
                  <Select value={sourceClientId} onValueChange={setSourceClientId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select source client" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredSourceClients
                        .filter((c) => c.account_balance > 0)
                        .map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.first_name} {c.last_name} ({c.client_number || "N/A"}) — {formatCurrency(c.account_balance)}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                {sourceClient && (
                  <div className="bg-muted/50 rounded-md p-3">
                    <p className="text-sm text-muted-foreground">Available Balance</p>
                    <p className="text-xl font-bold">{formatCurrency(sourceClient.account_balance)}</p>
                  </div>
                )}
              </div>

              {/* Destination */}
              <div className="space-y-4 p-4 border rounded-lg">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                  Destination (Transfer To)
                </h3>
                <div className="space-y-2">
                  <Label>Transfer Type</Label>
                  <Select
                    value={transferType}
                    onValueChange={(v) => {
                      setTransferType(v as "loan" | "account");
                      setDestLoanId("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="loan">Pay a Loan</SelectItem>
                      <SelectItem value="account">Transfer to Account</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Search Client</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      placeholder="Search by name or number..."
                      value={destSearch}
                      onChange={(e) => setDestSearch(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Select Destination Client</Label>
                  <Select value={destClientId} onValueChange={(v) => { setDestClientId(v); setDestLoanId(""); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select destination client" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredDestClients
                        .filter((c) => c.id !== sourceClientId)
                        .map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.first_name} {c.last_name} ({c.client_number || "N/A"})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {transferType === "loan" && destClientId && (
                  <div className="space-y-2">
                    <Label>Select Loan</Label>
                    {loadingLoans ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Loading loans...
                      </div>
                    ) : destLoans.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No active loans found for this client.</p>
                    ) : (
                      <Select value={destLoanId} onValueChange={setDestLoanId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select loan" />
                        </SelectTrigger>
                        <SelectContent>
                          {destLoans.map((l) => (
                            <SelectItem key={l.id} value={l.id}>
                              {l.loan_number || l.id.substring(0, 8)} — {l.type} — Balance: {formatCurrency(l.balance)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Amount & Notes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <div className="space-y-2">
                <Label>Transfer Amount *</Label>
                <Input
                  type="number"
                  placeholder="Enter amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  max={sourceClient?.account_balance || 0}
                />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  placeholder="Reason for transfer (optional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={1}
                />
              </div>
            </div>

            {/* Summary */}
            {sourceClient && destClient && amount && parseFloat(amount) > 0 && (
              <div className="mt-4 p-4 bg-muted/50 rounded-lg flex items-center gap-4 flex-wrap">
                <div className="text-sm">
                  <span className="font-medium">{sourceClient.first_name} {sourceClient.last_name}</span>
                  <span className="text-muted-foreground"> ({formatCurrency(sourceClient.account_balance)})</span>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <div className="text-sm font-medium text-primary">{formatCurrency(parseFloat(amount))}</div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <div className="text-sm">
                  <span className="font-medium">{destClient.first_name} {destClient.last_name}</span>
                  <span className="text-muted-foreground">
                    {transferType === "loan" ? " (Loan)" : " (Account)"}
                  </span>
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <Button
                onClick={handleTransfer}
                disabled={processing || !sourceClientId || !destClientId || !amount}
                size="lg"
              >
                {processing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <ArrowLeftRight className="mr-2 h-4 w-4" />
                    Transfer Funds
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default FundTransfers;
