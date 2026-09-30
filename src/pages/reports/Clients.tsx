import { useState, useEffect, useMemo } from "react";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { ReportPage } from "./Base";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ExportButton } from "@/components/ui/export-button";
import { ReportStat, ReportStats } from "@/components/reports/ReportStats";
import { DateRangePicker } from "@/components/reports/DateRangePicker";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getOrganizationId } from "@/lib/get-organization-id";
import { Users, UserCheck, UserX, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ClientRow {
  id: string;
  client_number: string;
  client_name: string;
  phone: string;
  id_number: string;
  gender: string;
  branch: string;
  loan_officer: string;
  status: string;
  registration_date: string;
  total_loans: number;
  active_loans: number;
}

const columns = [
  { key: "client_number", header: "Client No." },
  { key: "client_name", header: "Client Name" },
  { key: "id_number", header: "National ID" },
  { key: "phone", header: "Phone" },
  { key: "gender", header: "Gender" },
  { key: "branch", header: "Branch" },
  { key: "loan_officer", header: "Loan Officer" },
  { key: "status", header: "Status" },
  { key: "registration_date", header: "Registered" },
  { key: "total_loans", header: "Total Loans" },
  { key: "active_loans", header: "Active Loans" },
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ClientsReport = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [rows, setRows] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [officerFilter, setOfficerFilter] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [officers, setOfficers] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const orgId = await getOrganizationId();

        // Paginated fetch of all clients (1000-row limit safe)
        const clients: any[] = [];
        let from = 0;
        while (true) {
          const { data, error } = await supabase
            .from("clients")
            .select("id, client_number, first_name, last_name, phone, id_number, gender, status, registration_date, branch_id, loan_officer_id")
            .eq("organization_id", orgId)
            .order("created_at", { ascending: false })
            .range(from, from + 999);
          if (error) throw error;
          clients.push(...(data || []));
          if (!data || data.length < 1000) break;
          from += 1000;
        }

        // Paginated fetch of loans (excluding fee accounts)
        const loans: any[] = [];
        from = 0;
        while (true) {
          const { data, error } = await supabase
            .from("loans")
            .select("id, client, status")
            .eq("organization_id", orgId)
            .neq("type", "client_fee_account")
            .range(from, from + 999);
          if (error) throw error;
          loans.push(...(data || []));
          if (!data || data.length < 1000) break;
          from += 1000;
        }

        // Branches
        const { data: branchData } = await supabase
          .from("branches")
          .select("id, name")
          .eq("organization_id", orgId);
        const branchMap = new Map((branchData || []).map((b) => [b.id, b.name]));
        setBranches((branchData || []).sort((a, b) => a.name.localeCompare(b.name)));

        // Loan officer profiles
        const officerIds = [...new Set(clients.map((c) => c.loan_officer_id).filter(Boolean))] as string[];
        const profileMap = new Map<string, string>();
        for (let i = 0; i < officerIds.length; i += 50) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, first_name, last_name")
            .in("id", officerIds.slice(i, i + 50));
          (profiles || []).forEach((p) => {
            profileMap.set(p.id, `${p.first_name || ""} ${p.last_name || ""}`.trim() || "—");
          });
        }
        const officerList: { id: string; name: string }[] = [];
        profileMap.forEach((name, id) => officerList.push({ id, name }));
        setOfficers(officerList.sort((a, b) => a.name.localeCompare(b.name)));

        // Group loans by client ID and by name
        const loansById = new Map<string, any[]>();
        const loansByName = new Map<string, any[]>();
        loans.forEach((loan) => {
          if (UUID_RE.test(loan.client)) {
            if (!loansById.has(loan.client)) loansById.set(loan.client, []);
            loansById.get(loan.client)!.push(loan);
          } else {
            const key = loan.client.toLowerCase().replace(/\s+/g, " ").trim();
            if (!loansByName.has(key)) loansByName.set(key, []);
            loansByName.get(key)!.push(loan);
          }
        });

        const result: ClientRow[] = clients.map((c) => {
          const nameKey = `${c.first_name} ${c.last_name}`.toLowerCase().replace(/\s+/g, " ").trim();
          const clientLoans = [...(loansById.get(c.id) || []), ...(loansByName.get(nameKey) || [])];
          const activeLoans = clientLoans.filter((l) => ["active", "in_arrears"].includes(l.status)).length;
          return {
            id: c.id,
            client_number: c.client_number || "—",
            client_name: `${c.first_name} ${c.last_name}`.trim(),
            phone: c.phone || "—",
            id_number: c.id_number || "—",
            gender: c.gender || "—",
            branch: (c.branch_id && branchMap.get(c.branch_id)) || "—",
            loan_officer: (c.loan_officer_id && profileMap.get(c.loan_officer_id)) || "—",
            status: c.status || "—",
            registration_date: c.registration_date || "—",
            total_loans: clientLoans.length,
            active_loans: activeLoans,
          };
        });

        setRows(result);
      } catch (error: any) {
        toast({ title: "Error loading clients report", description: error.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const fromStr = dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : undefined;
    const toStr = dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : undefined;
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (branchFilter !== "all" && r.branch !== branchFilter) return false;
      if (officerFilter !== "all" && r.loan_officer !== officerFilter) return false;
      if (fromStr) {
        // registration_date is "YYYY-MM-DD" (or "—" when missing)
        const reg = /^\d{4}-\d{2}-\d{2}$/.test(r.registration_date) ? r.registration_date : undefined;
        if (!reg || reg < fromStr || (toStr && reg > toStr)) return false;
      }
      if (q && ![r.client_name, r.client_number, r.id_number, r.phone].some((v) => v.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [rows, searchQuery, statusFilter, branchFilter, officerFilter, dateRange]);

  const stats = useMemo(() => ({
    total: filtered.length,
    active: filtered.filter((r) => r.status === "active").length,
    pending: filtered.filter((r) => r.status === "pending").length,
    inactive: filtered.filter((r) => ["inactive", "dormant"].includes(r.status)).length,
  }), [filtered]);

  const statusBadge = (status: string) => {
    const variant =
      status === "active" ? "default" :
      status === "pending" ? "secondary" :
      "outline";
    return <Badge variant={variant} className="capitalize">{status}</Badge>;
  };

  return (
    <ReportPage
      title="Clients Report"
      description="Complete list of all registered clients with their loan activity"
      actions={
        <ExportButton
          data={filtered}
          columns={columns}
          filename={`clients-report-${new Date().toISOString().slice(0, 10)}`}
        />
      }
      filters={
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Input
            className="md:col-span-2"
            placeholder="Search name, client no., ID or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="dormant">Dormant</SelectItem>
            </SelectContent>
          </Select>
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger><SelectValue placeholder="Branch" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Branches</SelectItem>
              {branches.map((b) => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={officerFilter} onValueChange={setOfficerFilter}>
            <SelectTrigger><SelectValue placeholder="Loan Officer" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Officers</SelectItem>
              {officers.map((o) => <SelectItem key={o.id} value={o.name}>{o.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <DateRangePicker
            className="md:col-span-2"
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
          />
        </div>
      }
    >
      <ReportStats className="grid-cols-2 md:grid-cols-4">
        <ReportStat label="Total Clients" value={stats.total} icon={<Users className="h-5 w-5" />} />
        <ReportStat label="Active" value={stats.active} icon={<UserCheck className="h-5 w-5" />} />
        <ReportStat label="Pending Activation" value={stats.pending} icon={<Clock className="h-5 w-5" />} />
        <ReportStat label="Inactive / Dormant" value={stats.inactive} icon={<UserX className="h-5 w-5" />} />
      </ReportStats>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client No.</TableHead>
              <TableHead>Client Name</TableHead>
              <TableHead>National ID</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Gender</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Loan Officer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Registered</TableHead>
              <TableHead className="text-right">Total Loans</TableHead>
              <TableHead className="text-right">Active Loans</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-8">
                  <div className="flex justify-center">
                    <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                  </div>
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                  No clients match the current filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow
                  key={r.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/clients/${r.id}`)}
                >
                  <TableCell className="font-medium">{r.client_number}</TableCell>
                  <TableCell>{r.client_name}</TableCell>
                  <TableCell>{r.id_number}</TableCell>
                  <TableCell>{r.phone}</TableCell>
                  <TableCell className="capitalize">{r.gender}</TableCell>
                  <TableCell>{r.branch}</TableCell>
                  <TableCell>{r.loan_officer}</TableCell>
                  <TableCell>{statusBadge(r.status)}</TableCell>
                  <TableCell>{r.registration_date}</TableCell>
                  <TableCell className="text-right">{r.total_loans}</TableCell>
                  <TableCell className="text-right">{r.active_loans}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </ReportPage>
  );
};

export default ClientsReport;
