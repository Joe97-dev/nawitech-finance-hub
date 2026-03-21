import { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/dashboard/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Smartphone, RefreshCw, LinkIcon, Filter, TrendingUp, Calendar, CalendarDays, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ManualMatchDialog } from "@/components/admin/ManualMatchDialog";
import { ExportButton } from "@/components/ui/export-button";
import { DateRangePicker } from "@/components/reports/DateRangePicker";
import { DateRange } from "react-day-picker";

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
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [matchDialogOpen, setMatchDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<MpesaTransaction | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

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

  const filteredTransactions = useMemo(() => {
    let filtered = transactions;
    if (statusFilter !== "all") {
      filtered = filtered.filter(tx => tx.status === statusFilter);
    }
    if (dateRange?.from) {
      const from = new Date(dateRange.from);
      from.setHours(0, 0, 0, 0);
      filtered = filtered.filter(tx => new Date(tx.created_at) >= from);
    }
    if (dateRange?.to) {
      const to = new Date(dateRange.to);
      to.setHours(23, 59, 59, 999);
      filtered = filtered.filter(tx => new Date(tx.created_at) <= to);
    }
    return filtered;
  }, [transactions, statusFilter, dateRange]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Smartphone className="h-6 w-6" /> M-Pesa Payments
            </h1>
            <p className="text-muted-foreground">
              Manage C2B M-Pesa payment collections
            </p>
          </div>
        </div>

        {/* Collections Summary */}
        {(() => {
          const now = new Date();
          const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const dayOfWeek = now.getDay();
          const startOfWeek = new Date(startOfDay);
          startOfWeek.setDate(startOfDay.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

          const appliedTxs = transactions.filter(tx => tx.status === "applied");
          const todayTotal = appliedTxs.filter(tx => new Date(tx.created_at) >= startOfDay).reduce((s, tx) => s + tx.trans_amount, 0);
          const weekTotal = appliedTxs.filter(tx => new Date(tx.created_at) >= startOfWeek).reduce((s, tx) => s + tx.trans_amount, 0);
          const monthTotal = appliedTxs.filter(tx => new Date(tx.created_at) >= startOfMonth).reduce((s, tx) => s + tx.trans_amount, 0);
          const txCount = appliedTxs.length;

          return (
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                    <Calendar className="h-4 w-4" /> Today
                  </div>
                  <p className="text-2xl font-bold text-primary">{formatCurrency(todayTotal)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                    <CalendarDays className="h-4 w-4" /> This Week
                  </div>
                  <p className="text-2xl font-bold text-primary">{formatCurrency(weekTotal)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                    <CalendarDays className="h-4 w-4" /> This Month
                  </div>
                  <p className="text-2xl font-bold text-primary">{formatCurrency(monthTotal)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                    <TrendingUp className="h-4 w-4" /> Total Applied
                  </div>
                  <p className="text-2xl font-bold text-primary">{txCount} <span className="text-sm font-normal text-muted-foreground">transactions</span></p>
                </CardContent>
              </Card>
            </div>
          );
        })()}


        {/* Transactions Table */}
         <Card>
          <CardHeader className="flex flex-col gap-3">
            <div className="flex flex-row items-center justify-between flex-wrap gap-2">
              <CardTitle>M-Pesa Transactions</CardTitle>
              <div className="flex items-center gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]">
                    <Filter className="h-4 w-4 mr-1" />
                    <SelectValue placeholder="Filter status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="applied">Applied</SelectItem>
                    <SelectItem value="matched">Matched</SelectItem>
                    <SelectItem value="unmatched">Unmatched</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                  </SelectContent>
                </Select>
                <ExportButton
                  data={filteredTransactions.map(tx => ({
                    date: new Date(tx.created_at).toLocaleString(),
                    trans_id: tx.trans_id,
                    sender: [tx.first_name, tx.last_name].filter(Boolean).join(" ") || "",
                    phone: tx.msisdn,
                    bill_ref: tx.bill_ref_number || "",
                    amount: tx.trans_amount,
                    status: tx.status,
                  }))}
                  filename={`mpesa-transactions-${new Date().toISOString().slice(0, 10)}`}
                  columns={[
                    { key: "date", header: "Date" },
                    { key: "trans_id", header: "Transaction ID" },
                    { key: "sender", header: "Sender" },
                    { key: "phone", header: "Phone" },
                    { key: "bill_ref", header: "Bill Ref (ID No.)" },
                    { key: "amount", header: "Amount (KES)" },
                    { key: "status", header: "Status" },
                  ]}
                />
                <Button variant="outline" size="sm" onClick={fetchTransactions} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
                </Button>
              </div>
            </div>
            <div className="flex items-end gap-2">
              <DateRangePicker
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
                className="max-w-xs"
              />
              {dateRange?.from && (
                <Button variant="ghost" size="sm" onClick={() => setDateRange(undefined)} className="text-muted-foreground">
                  <X className="h-4 w-4 mr-1" /> Clear dates
                </Button>
              )}
              <span className="text-xs text-muted-foreground ml-auto">
                Showing {filteredTransactions.length} of {transactions.length} transactions
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Trans ID</TableHead>
                    <TableHead>Sender</TableHead>
                    
                    <TableHead>Ref (ID No.)</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        {loading ? "Loading..." : "No transactions match your filters"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTransactions.map(tx => (
                      <TableRow key={tx.id}>
                        <TableCell className="whitespace-nowrap">{new Date(tx.created_at).toLocaleString()}</TableCell>
                        <TableCell className="font-mono text-sm">{tx.trans_id}</TableCell>
                        <TableCell>{[tx.first_name, tx.last_name].filter(Boolean).join(" ") || "—"}</TableCell>
                        <TableCell>{tx.msisdn}</TableCell>
                        <TableCell>{tx.bill_ref_number || "—"}</TableCell>
                        <TableCell className="font-semibold text-green-600">{formatCurrency(tx.trans_amount)}</TableCell>
                        <TableCell>{getStatusBadge(tx.status)}</TableCell>
                        <TableCell>
                          {(tx.status === "unmatched" || tx.status === "matched") && !tx.payment_applied && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => { setSelectedTransaction(tx); setMatchDialogOpen(true); }}
                            >
                              <LinkIcon className="h-3 w-3 mr-1" /> Match
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}

                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <ManualMatchDialog
          open={matchDialogOpen}
          onOpenChange={setMatchDialogOpen}
          transaction={selectedTransaction}
          onMatched={fetchTransactions}
        />
      </div>
    </DashboardLayout>
  );
}
