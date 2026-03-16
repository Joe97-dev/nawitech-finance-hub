import { useState, useEffect, useMemo } from "react";
import { ReportPage } from "./Base";
import { DateRange } from "react-day-picker";
import { ExportButton } from "@/components/ui/export-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ReportFilters } from "@/components/reports/ReportFilters";
import { DateRangePicker } from "@/components/reports/DateRangePicker";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { getOrganizationId } from "@/lib/get-organization-id";

interface DisbursalData {
  id: string;
  client_name: string;
  loan_number: string;
  amount: number;
  disbursed_date: string;
  term_months: number;
  interest_rate: number;
  loan_officer: string;
  branch_name: string;
}

interface Branch {
  id: string;
  name: string;
}

const columns = [
  { key: "client_name", header: "Client Name" },
  { key: "loan_number", header: "Loan Number" },
  { key: "amount", header: "Amount (KES)" },
  { key: "disbursed_date", header: "Disbursed Date" },
  { key: "term_months", header: "Loan Term (Months)" },
  { key: "interest_rate", header: "Interest Rate (%)" },
  { key: "loan_officer", header: "Loan Officer" },
  { key: "branch_name", header: "Branch" },
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DisbursalReport = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [date, setDate] = useState<DateRange | undefined>();
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [disbursalData, setDisbursalData] = useState<DisbursalData[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const orgId = await getOrganizationId();

        const formatLocal = (d: Date) => {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${y}-${m}-${day}`;
        };

        // Paginated loan fetch
        let allLoans: any[] = [];
        let from = 0;
        const pageSize = 1000;

        while (true) {
          let query = supabase
            .from('loans')
            .select('id, client, loan_number, amount, date, term_months, interest_rate, loan_officer_id')
            .in('status', ['approved', 'disbursed', 'active', 'closed', 'in arrears'])
            .order('date', { ascending: false })
            .range(from, from + pageSize - 1);

          if (date?.from) query = query.gte('date', formatLocal(date.from));
          if (date?.to) query = query.lte('date', formatLocal(date.to));

          const { data, error } = await query;
          if (error) throw error;
          allLoans = allLoans.concat(data || []);
          if (!data || data.length < pageSize) break;
          from += pageSize;
        }

        // Resolve client names, officer names, branches in parallel
        const clientRefs = [...new Set(allLoans.map(l => (l.client || "").trim()).filter(Boolean))];
        const clientUuids = clientRefs.filter(r => UUID_RE.test(r));
        const officerIds = [...new Set(allLoans.map(l => l.loan_officer_id).filter(Boolean))] as string[];

        // Batch fetch clients
        const clientNameMap = new Map<string, string>();
        const clientBranchMap = new Map<string, string | null>();
        const batchSize = 50;
        for (let i = 0; i < clientUuids.length; i += batchSize) {
          const batch = clientUuids.slice(i, i + batchSize);
          const { data: clients } = await supabase
            .from('clients')
            .select('id, first_name, last_name, branch_id')
            .in('id', batch);
          (clients || []).forEach(c => {
            clientNameMap.set(c.id, `${c.first_name} ${c.last_name}`);
            clientBranchMap.set(c.id, c.branch_id);
          });
        }

        // Fetch officers and branches
        const [profilesRes, branchesRes] = await Promise.all([
          officerIds.length > 0
            ? supabase.from('profiles').select('id, first_name, last_name').in('id', officerIds)
            : Promise.resolve({ data: [] }),
          supabase.from('branches').select('id, name').eq('organization_id', orgId).order('name'),
        ]);

        const profileMap = new Map<string, string>();
        (profilesRes.data || []).forEach(p => {
          profileMap.set(p.id, `${p.first_name || ''} ${p.last_name || ''}`.trim() || '—');
        });

        const branchNameMap = new Map<string, string>();
        (branchesRes.data || []).forEach(b => branchNameMap.set(b.id, b.name));
        setBranches(branchesRes.data || []);

        const resolveClient = (ref: string) => {
          const r = (ref || "").trim();
          if (!r) return "Unknown";
          return clientNameMap.get(r) || (UUID_RE.test(r) ? "Unknown" : r);
        };

        const resolveBranch = (ref: string) => {
          const r = (ref || "").trim();
          const branchId = clientBranchMap.get(r);
          return branchId ? branchNameMap.get(branchId) || "—" : "—";
        };

        const transformed: DisbursalData[] = allLoans.map(loan => ({
          id: loan.id,
          client_name: resolveClient(loan.client),
          loan_number: loan.loan_number || 'N/A',
          amount: loan.amount,
          disbursed_date: loan.date,
          term_months: loan.term_months || 12,
          interest_rate: loan.interest_rate || 15,
          loan_officer: loan.loan_officer_id ? profileMap.get(loan.loan_officer_id) || '—' : '—',
          branch_name: resolveBranch(loan.client),
        }));

        setDisbursalData(transformed);
      } catch (error: any) {
        console.error("Error fetching disbursal data:", error);
        toast({ variant: "destructive", title: "Data fetch error", description: "Failed to load disbursal data." });
        setDisbursalData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [toast, date]);

  const filteredDisbursals = useMemo(() =>
    disbursalData.filter(loan => {
      const matchesSearch = searchQuery === "" ||
        loan.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        loan.loan_number.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesBranch = selectedBranch === "all" ||
        loan.branch_name === branches.find(b => b.id === selectedBranch)?.name;
      return matchesSearch && matchesBranch;
    }),
    [disbursalData, searchQuery, selectedBranch, branches]
  );

  const totalDisbursed = filteredDisbursals.reduce((acc, l) => acc + l.amount, 0);

  const hasActiveFilters = searchQuery !== "" || selectedBranch !== "all" || date !== undefined;

  const handleReset = () => {
    setSearchQuery("");
    setSelectedBranch("all");
    setDate(undefined);
  };

  const filters = (
    <ReportFilters title="Disbursal Report Filters" hasActiveFilters={hasActiveFilters} onReset={handleReset}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <DateRangePicker dateRange={date} onDateRangeChange={setDate} className="col-span-1 sm:col-span-1" />

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Branch</label>
          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
            <SelectTrigger className="border-dashed">
              <SelectValue placeholder="Select Branch" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Branches</SelectItem>
              {branches.map(b => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Search</label>
          <Input
            placeholder="Search by client name or loan number"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="border-dashed"
          />
        </div>
      </div>

      <div className="bg-muted/50 p-3 rounded-md flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div className="text-sm mb-2 sm:mb-0">
          <span className="font-medium">{filteredDisbursals.length}</span> loans disbursed
        </div>
        <div className="text-sm font-medium">
          Total disbursed: <span className="text-primary">KES {totalDisbursed.toLocaleString()}</span>
        </div>
      </div>
    </ReportFilters>
  );

  return (
    <ReportPage
      title="Disbursal Report"
      description="Loans disbursed within a specific date range"
      actions={
        <ExportButton
          data={filteredDisbursals.map(loan => ({
            client_name: loan.client_name,
            loan_number: loan.loan_number,
            amount: loan.amount.toLocaleString(),
            disbursed_date: new Date(loan.disbursed_date).toLocaleDateString(),
            term_months: loan.term_months,
            interest_rate: loan.interest_rate,
            loan_officer: loan.loan_officer,
            branch_name: loan.branch_name,
          }))}
          filename={`disbursal-report-${new Date().toISOString().slice(0, 10)}`}
          columns={columns}
        />
      }
      filters={filters}
    >
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-card border rounded-lg p-4 shadow-sm">
            <div className="text-sm text-muted-foreground">Total Disbursed</div>
            <div className="text-2xl font-bold mt-1">KES {totalDisbursed.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-1">{filteredDisbursals.length} loans</div>
          </div>

          <div>
            <h3 className="text-lg font-medium mb-2">Loan Disbursals</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client Name</TableHead>
                  <TableHead>Loan Number</TableHead>
                  <TableHead>Amount (KES)</TableHead>
                  <TableHead>Disbursed Date</TableHead>
                  <TableHead>Loan Term</TableHead>
                  <TableHead>Interest Rate</TableHead>
                  <TableHead>Loan Officer</TableHead>
                  <TableHead>Branch</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDisbursals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-4 text-muted-foreground">
                      No disbursals found for the selected criteria
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDisbursals.map(loan => (
                    <TableRow
                      key={loan.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/loans/${loan.id}`)}
                    >
                      <TableCell className="font-medium">{loan.client_name}</TableCell>
                      <TableCell className="font-mono text-sm">{loan.loan_number}</TableCell>
                      <TableCell>{loan.amount.toLocaleString()}</TableCell>
                      <TableCell>{new Date(loan.disbursed_date).toLocaleDateString()}</TableCell>
                      <TableCell>{loan.term_months} months</TableCell>
                      <TableCell>{loan.interest_rate}%</TableCell>
                      <TableCell>{loan.loan_officer}</TableCell>
                      <TableCell>{loan.branch_name}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </ReportPage>
  );
};

export default DisbursalReport;
