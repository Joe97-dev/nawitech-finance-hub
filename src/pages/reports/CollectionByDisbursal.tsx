import { useState, useEffect } from "react";
import { ReportPage } from "./Base";
import { ExportButton } from "@/components/ui/export-button";
import { Card, CardContent } from "@/components/ui/card";
import { ReportFilters } from "@/components/reports/ReportFilters";
import { ReportStat, ReportStats } from "@/components/reports/ReportStats";
import { DateRangePicker } from "@/components/reports/DateRangePicker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DateRange } from "react-day-picker";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

interface LoanCollectionRow {
  loan_number: string;
  client_name: string;
  loan_officer: string;
  loan_officer_id: string | null;
  disbursement_date: string;
  amount_disbursed: number;
  total_due: number;
  total_paid: number;
  outstanding: number;
  collection_rate: number;
  status: string;
}

const columns = [
  { key: "loan_number", header: "Loan #" },
  { key: "client_name", header: "Client" },
  { key: "loan_officer", header: "Loan Officer" },
  { key: "disbursement_date", header: "Disbursal Date" },
  { key: "amount_disbursed", header: "Disbursed (KES)" },
  { key: "total_due", header: "Total Due (KES)" },
  { key: "total_paid", header: "Total Paid (KES)" },
  { key: "outstanding", header: "Outstanding (KES)" },
  { key: "collection_rate", header: "Collection Rate (%)" },
  { key: "status", header: "Status" },
];

const CollectionByDisbursalReport = () => {
  const { toast } = useToast();
  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date(),
  });
  const [rows, setRows] = useState<LoanCollectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [officers, setOfficers] = useState<{ id: string; name: string }[]>([]);
  const [selectedOfficer, setSelectedOfficer] = useState("all");

  useEffect(() => {
    fetchData();
  }, [date]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const startDate = date?.from || new Date(new Date().getFullYear(), 0, 1);
      const endDate = date?.to || new Date();
      const fromStr = format(startDate, "yyyy-MM-dd");
      const toStr = format(endDate, "yyyy-MM-dd");

      // Fetch loans, clients, and profiles in parallel
      const [loansResult, clientsResult, profilesResult] = await Promise.all([
        supabase
          .from("loans")
          .select("id, loan_number, client, amount, date, loan_officer_id, status")
          .gte("date", fromStr)
          .lte("date", toStr)
          .in("status", ["active", "closed", "in arrears", "disbursed", "approved"]),
        supabase.from("clients").select("id, first_name, last_name"),
        supabase.from("profiles").select("id, first_name, last_name"),
      ]);

      if (loansResult.error) throw loansResult.error;

      const loans = loansResult.data || [];
      const clients = clientsResult.data || [];
      const profiles = profilesResult.data || [];

      const clientMap = new Map(clients.map((c) => [c.id, `${c.first_name} ${c.last_name}`]));
      const profileMap = new Map(
        profiles.map((p) => {
          const name = `${p.first_name || ""} ${p.last_name || ""}`.trim();
          return [p.id, name || p.username || p.id.slice(0, 8)];
        })
      );

      // Build officer list
      const officerSet = new Map<string, string>();
      loans.forEach((l) => {
        if (l.loan_officer_id && !officerSet.has(l.loan_officer_id)) {
          officerSet.set(l.loan_officer_id, profileMap.get(l.loan_officer_id) || "Unknown");
        }
      });
      setOfficers(
        Array.from(officerSet.entries())
          .map(([id, name]) => ({ id, name }))
          .sort((a, b) => a.name.localeCompare(b.name))
      );

      if (loans.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      // Fetch all schedules for these loans in batches of 50
      const loanIds = loans.map((l) => l.id);
      const allSchedules: { loan_id: string; total_due: number; amount_paid: number }[] = [];
      for (let i = 0; i < loanIds.length; i += 50) {
        const chunk = loanIds.slice(i, i + 50);
        const { data, error } = await supabase
          .from("loan_schedule")
          .select("loan_id, total_due, amount_paid")
          .in("loan_id", chunk);
        if (error) throw error;
        allSchedules.push(...(data || []));
      }

      // Aggregate schedules by loan
      const schedulesByLoan = new Map<string, { totalDue: number; totalPaid: number }>();
      for (const s of allSchedules) {
        const existing = schedulesByLoan.get(s.loan_id) || { totalDue: 0, totalPaid: 0 };
        existing.totalDue += Number(s.total_due);
        existing.totalPaid += Number(s.amount_paid || 0);
        schedulesByLoan.set(s.loan_id, existing);
      }

      // Build rows
      const result: LoanCollectionRow[] = loans.map((loan) => {
        const schedule = schedulesByLoan.get(loan.id) || { totalDue: 0, totalPaid: 0 };
        const outstanding = schedule.totalDue - schedule.totalPaid;
        const rate = schedule.totalDue > 0 ? Math.round((schedule.totalPaid / schedule.totalDue) * 10000) / 100 : 0;
        const clientName = clientMap.get(loan.client) || loan.client;
        const officerName = loan.loan_officer_id ? (profileMap.get(loan.loan_officer_id) || "Unknown") : "Unassigned";

        return {
          loan_number: loan.loan_number || loan.id.slice(0, 8),
          client_name: clientName,
          loan_officer: officerName,
          loan_officer_id: loan.loan_officer_id,
          disbursement_date: loan.date,
          amount_disbursed: Number(loan.amount),
          total_due: schedule.totalDue,
          total_paid: schedule.totalPaid,
          outstanding: Math.max(0, outstanding),
          collection_rate: rate,
          status: loan.status,
        };
      });

      // Sort by date descending
      result.sort((a, b) => b.disbursement_date.localeCompare(a.disbursement_date));
      setRows(result);
    } catch (error: any) {
      console.error("Error fetching data:", error);
      toast({
        variant: "destructive",
        title: "Data fetch error",
        description: error.message || "Failed to load data.",
      });
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredRows =
    selectedOfficer === "all" ? rows : rows.filter((r) => r.loan_officer_id === selectedOfficer);

  const totalDisbursed = filteredRows.reduce((s, r) => s + r.amount_disbursed, 0);
  const totalDue = filteredRows.reduce((s, r) => s + r.total_due, 0);
  const totalPaid = filteredRows.reduce((s, r) => s + r.total_paid, 0);
  const overallRate = totalDue > 0 ? Math.round((totalPaid / totalDue) * 100) : 0;

  const hasActiveFilters = selectedOfficer !== "all" || date !== undefined;

  const handleReset = () => {
    setSelectedOfficer("all");
    setDate({
      from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      to: new Date(),
    });
  };

  const exportData = filteredRows.map((r) => ({
    ...r,
    amount_disbursed: r.amount_disbursed.toLocaleString(),
    total_due: r.total_due.toLocaleString(),
    total_paid: r.total_paid.toLocaleString(),
    outstanding: r.outstanding.toLocaleString(),
  }));

  const filters = (
    <ReportFilters
      title="Disbursal Period Filters"
      hasActiveFilters={hasActiveFilters}
      onReset={handleReset}
    >
      <DateRangePicker dateRange={date} onDateRangeChange={setDate} className="w-full sm:w-auto" />
      {officers.length > 0 && (
        <Select value={selectedOfficer} onValueChange={setSelectedOfficer}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Loan Officer" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Officers</SelectItem>
            {officers.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </ReportFilters>
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-100 text-green-800";
      case "closed": return "bg-muted text-muted-foreground";
      case "in arrears": return "bg-red-100 text-red-800";
      default: return "bg-yellow-100 text-yellow-800";
    }
  };

  return (
    <ReportPage
      title="Collection by Disbursal Period"
      description="Detailed loan-level collection rates for loans disbursed within a selected date range."
      actions={<ExportButton data={exportData} filename="collection-by-disbursal" columns={columns} />}
      filters={filters}
    >
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin mr-2" />
          <p>Loading data...</p>
        </div>
      ) : (
        <div className="space-y-6">
          <ReportStats>
            <ReportStat label="Loans" value={filteredRows.length.toLocaleString()} />
            <ReportStat label="Total Disbursed" value={`KES ${totalDisbursed.toLocaleString()}`} />
            <ReportStat
              label="Overall Collection Rate"
              value={`${overallRate}%`}
              subValue={
                <div className="w-full bg-muted rounded-full h-2.5 mt-2">
                  <div
                    className={`h-2.5 rounded-full ${
                      overallRate >= 95 ? "bg-green-600" : overallRate >= 80 ? "bg-yellow-400" : "bg-destructive"
                    }`}
                    style={{ width: `${Math.min(overallRate, 100)}%` }}
                  />
                </div>
              }
            />
          </ReportStats>

          <Card className="shadow-sm">
            <CardContent className="pt-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-4">
                Loan Details ({filteredRows.length} loans)
              </h3>
              {filteredRows.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No loans found for the selected period
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Loan #</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Loan Officer</TableHead>
                        <TableHead>Disbursal Date</TableHead>
                        <TableHead className="text-right">Disbursed</TableHead>
                        <TableHead className="text-right">Total Due</TableHead>
                        <TableHead className="text-right">Total Paid</TableHead>
                        <TableHead className="text-right">Outstanding</TableHead>
                        <TableHead className="text-right">Collection Rate</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRows.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{r.loan_number}</TableCell>
                          <TableCell>{r.client_name}</TableCell>
                          <TableCell>{r.loan_officer}</TableCell>
                          <TableCell>{r.disbursement_date}</TableCell>
                          <TableCell className="text-right">KES {r.amount_disbursed.toLocaleString()}</TableCell>
                          <TableCell className="text-right">KES {r.total_due.toLocaleString()}</TableCell>
                          <TableCell className="text-right">KES {r.total_paid.toLocaleString()}</TableCell>
                          <TableCell className="text-right">KES {r.outstanding.toLocaleString()}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <span>{r.collection_rate}%</span>
                              <div className="w-12 bg-muted rounded-full h-1.5">
                                <div
                                  className={`h-1.5 rounded-full ${
                                    r.collection_rate >= 95
                                      ? "bg-green-600"
                                      : r.collection_rate >= 80
                                      ? "bg-yellow-400"
                                      : "bg-destructive"
                                  }`}
                                  style={{ width: `${Math.min(r.collection_rate, 100)}%` }}
                                />
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(r.status)}`}>
                              {r.status}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Totals row */}
                      <TableRow className="bg-muted/50 font-semibold">
                        <TableCell colSpan={4}>Totals</TableCell>
                        <TableCell className="text-right">KES {totalDisbursed.toLocaleString()}</TableCell>
                        <TableCell className="text-right">KES {totalDue.toLocaleString()}</TableCell>
                        <TableCell className="text-right">KES {totalPaid.toLocaleString()}</TableCell>
                        <TableCell className="text-right">KES {(totalDue - totalPaid).toLocaleString()}</TableCell>
                        <TableCell className="text-right">{overallRate}%</TableCell>
                        <TableCell />
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </ReportPage>
  );
};

export default CollectionByDisbursalReport;
