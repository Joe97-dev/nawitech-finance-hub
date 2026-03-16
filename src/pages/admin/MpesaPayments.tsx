import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Smartphone, RefreshCw, Play, Link2 } from "lucide-react";

interface MpesaTransaction {
  id: string;
  trans_id: string;
  trans_time: string;
  trans_amount: number;
  msisdn: string;
  bill_ref_number: string | null;
  first_name: string | null;
  last_name: string | null;
  status: string;
  payment_applied: boolean;
  created_at: string;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "KES", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

const getStatusBadge = (status: string) => {
  switch (status) {
    case "applied":
      return <Badge className="bg-green-100 text-green-800 border-green-200">Applied</Badge>;
    case "matched":
      return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Matched</Badge>;
    case "unmatched":
      return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Unmatched</Badge>;
    case "error":
      return <Badge variant="destructive">Error</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

export default function MpesaPayments() {
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<MpesaTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [simForm, setSimForm] = useState({ amount: "", phoneNumber: "254708374149", billRefNumber: "" });

  useEffect(() => { fetchTransactions(); }, []);

  const fetchTransactions = async () => {
    setLoading(true);
    const { data, error } = await (supabase.from("mpesa_transactions" as any).select("*").order("created_at", { ascending: false }).limit(100)) as any;
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      setTransactions(data || []);
    }
    setLoading(false);
  };

  const registerUrls = async () => {
    setRegistering(true);
    try {
      const { data, error } = await supabase.functions.invoke("mpesa-register-urls", {
        body: { useSandbox: true },
      });
      if (error) throw error;
      if (data?.success) {
        toast({ title: "URLs Registered", description: `Validation: ${data.registeredUrls?.validation}\nConfirmation: ${data.registeredUrls?.confirmation}` });
      } else {
        toast({ variant: "destructive", title: "Registration Failed", description: JSON.stringify(data?.data || data?.error) });
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setRegistering(false);
    }
  };

  const simulatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSimulating(true);
    try {
      const { data, error } = await supabase.functions.invoke("mpesa-simulate-c2b", {
        body: {
          amount: parseInt(simForm.amount),
          phoneNumber: simForm.phoneNumber,
          billRefNumber: simForm.billRefNumber,
        },
      });
      if (error) throw error;
      if (data?.success) {
        toast({ title: "Simulation Sent", description: "C2B payment simulation dispatched. Check transactions below." });
        setTimeout(fetchTransactions, 3000);
      } else {
        toast({ variant: "destructive", title: "Simulation Failed", description: JSON.stringify(data?.data || data?.error) });
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setSimulating(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Smartphone className="h-6 w-6" /> M-Pesa Payments
            </h1>
            <p className="text-muted-foreground">Manage C2B M-Pesa payment integration (Sandbox)</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Register URLs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Link2 className="h-5 w-5" /> Register C2B URLs</CardTitle>
              <CardDescription>Register validation and confirmation URLs with Safaricom sandbox</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={registerUrls} disabled={registering} className="w-full">
                {registering ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Registering...</> : "Register URLs"}
              </Button>
            </CardContent>
          </Card>

          {/* Simulate Payment */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Play className="h-5 w-5" /> Simulate C2B Payment</CardTitle>
              <CardDescription>Test a C2B payment using the sandbox simulator</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={simulatePayment} className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="sim_amount">Amount (KES)</Label>
                  <Input id="sim_amount" type="number" placeholder="1000" value={simForm.amount} onChange={e => setSimForm(p => ({ ...p, amount: e.target.value }))} required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="sim_phone">Phone Number</Label>
                  <Input id="sim_phone" placeholder="254708374149" value={simForm.phoneNumber} onChange={e => setSimForm(p => ({ ...p, phoneNumber: e.target.value }))} required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="sim_ref">Bill Ref (Client National ID)</Label>
                  <Input id="sim_ref" placeholder="Enter client's national ID" value={simForm.billRefNumber} onChange={e => setSimForm(p => ({ ...p, billRefNumber: e.target.value }))} required />
                </div>
                <Button type="submit" disabled={simulating} className="w-full">
                  {simulating ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Simulating...</> : "Simulate Payment"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Transactions Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>M-Pesa Transactions</CardTitle>
            <Button variant="outline" size="sm" onClick={fetchTransactions} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Trans ID</TableHead>
                    <TableHead>Sender</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Ref (ID No.)</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        {loading ? "Loading..." : "No M-Pesa transactions yet"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    transactions.map(tx => (
                      <TableRow key={tx.id}>
                        <TableCell className="whitespace-nowrap">{new Date(tx.created_at).toLocaleString()}</TableCell>
                        <TableCell className="font-mono text-sm">{tx.trans_id}</TableCell>
                        <TableCell>{[tx.first_name, tx.last_name].filter(Boolean).join(" ") || "—"}</TableCell>
                        <TableCell>{tx.msisdn}</TableCell>
                        <TableCell>{tx.bill_ref_number || "—"}</TableCell>
                        <TableCell className="font-semibold text-green-600">{formatCurrency(tx.trans_amount)}</TableCell>
                        <TableCell>{getStatusBadge(tx.status)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
