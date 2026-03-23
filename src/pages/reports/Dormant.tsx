import { useState, useEffect } from "react";
import { ReportPage } from "./Base";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExportButton } from "@/components/ui/export-button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReportFilters } from "@/components/reports/ReportFilters";
import { ReportStat, ReportStats } from "@/components/reports/ReportStats";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getOrganizationId } from "@/lib/get-organization-id";
import { PostClientFeeDialog } from "@/components/clients/PostClientFeeDialog";
import { UserCheck, AlertTriangle, Clock, Ban } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface InactiveClientData {
  id: string;
  client_name: string;
  phone_number: string;
  last_loan_date: string;
  days_without_loan: number;
  current_status: string;
  category: "inactive" | "dormant";
  loan_officer: string;
}

const columns = [
  { key: "client_name", header: "Client Name" },
  { key: "loan_officer", header: "Loan Officer" },
  { key: "phone_number", header: "Phone Number" },
  { key: "last_loan_date", header: "Last Repayment Date" },
  { key: "days_without_loan", header: "Days Since Last Repayment" },
  { key: "category", header: "Category" },
  { key: "current_status", header: "Current Status" },
];

const DormantClientsReport = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [clientsData, setClientsData] = useState<InactiveClientData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [loanOfficers, setLoanOfficers] = useState<{ id: string; name: string }[]>([]);
  const [selectedOfficer, setSelectedOfficer] = useState("all");

  const fetchData = async () => {
    try {
      setLoading(true);
      const orgId = await getOrganizationId();

      // Fetch all clients (not just active — dormant/inactive too)
      const { data: clients, error: clientsError } = await supabase
        .from("clients")
        .select("id, first_name, last_name, phone, status, created_at, loan_officer_id")
        .eq("organization_id", orgId)
        .in("status", ["active", "inactive", "dormant"]);

      if (clientsError) throw clientsError;

      // Fetch all loans per client name/ID (excluding fee accounts)
      const { data: loans, error: loansError } = await supabase
        .from("loans")
        .select("id, client, status")
        .eq("organization_id", orgId)
        .neq("type", "client_fee_account");

      if (loansError) throw loansError;

      // Resolve loan officer names
      const officerIds = [...new Set((clients || []).map(c => c.loan_officer_id).filter(Boolean))] as string[];
      const profileMap = new Map<string, string>();
      if (officerIds.length > 0) {
        const batchSize = 50;
        for (let i = 0; i < officerIds.length; i += batchSize) {
          const batch = officerIds.slice(i, i + batchSize);
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, first_name, last_name")
            .in("id", batch);
          (profiles || []).forEach((p) => {
            profileMap.set(p.id, `${p.first_name || ""} ${p.last_name || ""}`.trim() || "—");
          });
        }
      }

      // Build loan officers list for filter
      const officersList: { id: string; name: string }[] = [];
      profileMap.forEach((name, id) => {
        officersList.push({ id, name });
      });
      officersList.sort((a, b) => a.name.localeCompare(b.name));
      setLoanOfficers(officersList);

      // Group loans by client — match by both UUID and name
      const loansByClientId = new Map<string, typeof loans>();
      const loansByClientName = new Map<string, typeof loans>();
      (loans || []).forEach((loan) => {
        // If loan.client looks like a UUID, group by ID
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(loan.client);
        if (isUuid) {
          if (!loansByClientId.has(loan.client)) loansByClientId.set(loan.client, []);
          loansByClientId.get(loan.client)!.push(loan);
        } else {
          const name = loan.client.toLowerCase().trim();
          if (!loansByClientName.has(name)) loansByClientName.set(name, []);
          loansByClientName.get(name)!.push(loan);
        }
      });

      // Helper to get all loans for a client (by ID and by name)
      const getClientLoans = (clientId: string, firstName: string, lastName: string) => {
        const byId = loansByClientId.get(clientId) || [];
        const byName = loansByClientName.get(`${firstName} ${lastName}`.toLowerCase().trim()) || [];
        return [...byId, ...byName];
      };

      // Split clients into those with active loans vs no active loans
      const clientsWithActiveLoans: typeof clients = [];
      const clientsWithNoActiveLoans: typeof clients = [];
      (clients || []).forEach((client) => {
        const clientLoans = getClientLoans(client.id, client.first_name, client.last_name);
        const hasActiveLoan = clientLoans.some(
          (l) => l.status !== "closed" && l.status !== "rejected" && l.status !== "written_off"
        );
        if (hasActiveLoan) {
          clientsWithActiveLoans.push(client);
        } else {
          clientsWithNoActiveLoans.push(client);
        }
      });

      // Get all closed loan IDs for these clients to fetch last repayment transaction dates
      const closedLoanIds: string[] = [];
      const loanIdToClient = new Map<string, string>();
      clientsWithNoActiveLoans.forEach((client) => {
        const fullName = `${client.first_name} ${client.last_name}`.toLowerCase();
        const clientLoans = getClientLoans(client.id, client.first_name, client.last_name);
        clientLoans.forEach((l) => {
          closedLoanIds.push(l.id);
          loanIdToClient.set(l.id, fullName);
        });
      });

      // Fetch last repayment transaction dates from loan_transactions in batches
      const lastRepaymentDateMap = new Map<string, string>();
      for (let i = 0; i < closedLoanIds.length; i += 50) {
        const batch = closedLoanIds.slice(i, i + 50);
        const { data: transactions } = await supabase
          .from("loan_transactions")
          .select("loan_id, transaction_date")
          .in("loan_id", batch)
          .eq("transaction_type", "repayment")
          .eq("is_reverted", false)
          .order("transaction_date", { ascending: false });

        (transactions || []).forEach((t) => {
          const clientName = loanIdToClient.get(t.loan_id);
          if (clientName) {
            const txDate = t.transaction_date.split("T")[0]; // normalize to date string
            const existing = lastRepaymentDateMap.get(clientName);
            if (!existing || txDate > existing) {
              lastRepaymentDateMap.set(clientName, txDate);
            }
          }
        });
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const results: InactiveClientData[] = [];
      const activeIdsToUpdate = new Set(
        clientsWithActiveLoans
          .filter((client) => client.status !== "active")
          .map((client) => client.id)
      );
      const inactiveIdsToUpdate: string[] = [];
      const dormantIdsToUpdate: string[] = [];

      clientsWithNoActiveLoans.forEach((client) => {
        const fullName = `${client.first_name} ${client.last_name}`;
        const lastRepaymentDate = lastRepaymentDateMap.get(fullName.toLowerCase());

        const referenceDate = lastDueDate || client.created_at;
        const refDate = new Date(referenceDate);
        refDate.setHours(0, 0, 0, 0);
        const daysWithoutLoan = Math.max(0, Math.round((today.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24)));

        if (daysWithoutLoan < 7) {
          if (client.status !== "active") {
            activeIdsToUpdate.add(client.id);
          }
          return;
        }

        const category: "inactive" | "dormant" = daysWithoutLoan >= 30 ? "dormant" : "inactive";

        if (category === "dormant" && client.status !== "dormant") {
          dormantIdsToUpdate.push(client.id);
        }
        if (category === "inactive" && client.status !== "inactive") {
          inactiveIdsToUpdate.push(client.id);
        }

        results.push({
          id: client.id,
          client_name: fullName,
          phone_number: client.phone || "N/A",
          last_loan_date: lastDueDate || "No loans",
          days_without_loan: daysWithoutLoan,
          current_status: category,
          category,
          loan_officer: client.loan_officer_id ? profileMap.get(client.loan_officer_id) || "—" : "—",
        });
      });

      const activeIds = Array.from(activeIdsToUpdate);
      if (activeIds.length > 0) {
        await supabase
          .from("clients")
          .update({ status: "active" })
          .in("id", activeIds)
          .eq("organization_id", orgId);
      }

      if (inactiveIdsToUpdate.length > 0) {
        await supabase
          .from("clients")
          .update({ status: "inactive" })
          .in("id", inactiveIdsToUpdate)
          .eq("organization_id", orgId);
      }

      if (dormantIdsToUpdate.length > 0) {
        await supabase
          .from("clients")
          .update({ status: "dormant" })
          .in("id", dormantIdsToUpdate)
          .eq("organization_id", orgId);
      }

      results.sort((a, b) => b.days_without_loan - a.days_without_loan);
      setClientsData(results);
    } catch (error: any) {
      console.error("Error fetching data:", error);
      toast({
        variant: "destructive",
        title: "Data fetch error",
        description: "Failed to load client data.",
      });
      setClientsData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleActivateInactive = async (clientId: string, clientName: string) => {
    setActivatingId(clientId);
    try {
      const { error } = await supabase
        .from("clients")
        .update({ status: "active" })
        .eq("id", clientId);

      if (error) throw error;

      toast({
        title: "Client activated",
        description: `${clientName} has been set to active.`,
      });
      fetchData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Activation failed",
        description: error.message,
      });
    } finally {
      setActivatingId(null);
    }
  };

  // Filter
  const filteredData = clientsData.filter((client) => {
    const matchesTab =
      activeTab === "all" ||
      (activeTab === "inactive" && client.category === "inactive") ||
      (activeTab === "dormant" && client.category === "dormant");

    const matchesSearch =
      searchQuery === "" ||
      client.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.phone_number.includes(searchQuery);

    const matchesOfficer =
      selectedOfficer === "all" || client.loan_officer === selectedOfficer;

    return matchesTab && matchesSearch && matchesOfficer;
  });

  const inactiveCount = clientsData.filter((c) => c.category === "inactive").length;
  const dormantCount = clientsData.filter((c) => c.category === "dormant").length;
  const avgDays =
    filteredData.length > 0
      ? Math.round(filteredData.reduce((sum, c) => sum + c.days_without_loan, 0) / filteredData.length)
      : 0;

  const hasActiveFilters = searchQuery !== "" || selectedOfficer !== "all";

  const handleReset = () => {
    setSearchQuery("");
    setSelectedOfficer("all");
  };

  const getCategoryBadge = (client: InactiveClientData) => {
    if (client.category === "dormant") {
      return (
        <Badge variant="destructive" className="gap-1">
          <Ban className="h-3 w-3" />
          Dormant
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="gap-1">
        <Clock className="h-3 w-3" />
        Inactive
      </Badge>
    );
  };

  return (
    <ReportPage
      title="Dormant & Inactive Clients"
      description="Clients with no active loans — Inactive (7-29 days) or Dormant (30+ days) since last due date"
      actions={
        <ExportButton
          data={filteredData.map((c) => ({
            client_name: c.client_name,
            loan_officer: c.loan_officer,
            phone_number: c.phone_number,
            last_loan_date: c.last_loan_date === "No loans" ? "No loans" : new Date(c.last_loan_date).toLocaleDateString(),
            days_without_loan: c.days_without_loan,
            category: c.category,
            current_status: c.current_status,
          }))}
          filename={`dormant-inactive-report-${new Date().toISOString().slice(0, 10)}`}
          columns={columns}
        />
      }
      filters={
        <ReportFilters
          title="Client Activity Filters"
          hasActiveFilters={hasActiveFilters}
          onReset={handleReset}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Search
              </label>
              <Input
                placeholder="Search by client name or phone number"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="border-dashed"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Loan Officer
              </label>
              <Select value={selectedOfficer} onValueChange={setSelectedOfficer}>
                <SelectTrigger className="border-dashed">
                  <SelectValue placeholder="All Officers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Officers</SelectItem>
                  {loanOfficers.map((officer) => (
                    <SelectItem key={officer.id} value={officer.name}>
                      {officer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </ReportFilters>
      }
    >
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-6">
          <ReportStats>
            <ReportStat
              label="Total Flagged"
              value={clientsData.length.toString()}
              subValue="7+ days without a loan"
              icon={<AlertTriangle className="h-5 w-5" />}
            />
            <ReportStat
              label="Inactive Clients"
              value={inactiveCount.toString()}
              subValue="7-29 days (can reactivate directly)"
              icon={<Clock className="h-5 w-5" />}
            />
            <ReportStat
              label="Dormant Clients"
              value={dormantCount.toString()}
              subValue="30+ days (fee required)"
              icon={<Ban className="h-5 w-5" />}
            />
            <ReportStat
              label="Avg Days Without Loan"
              value={`${avgDays} days`}
              subValue="Across filtered clients"
              icon={<UserCheck className="h-5 w-5" />}
            />
          </ReportStats>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="all">All ({clientsData.length})</TabsTrigger>
              <TabsTrigger value="inactive">Inactive ({inactiveCount})</TabsTrigger>
              <TabsTrigger value="dormant">Dormant ({dormantCount})</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab}>
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Client Name</TableHead>
                        <TableHead>Loan Officer</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Last Due Date</TableHead>
                        <TableHead>Days Since</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredData.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            No clients found for the selected criteria
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredData.map((client) => (
                          <TableRow key={client.id}>
                            <TableCell
                              className="font-medium cursor-pointer hover:underline"
                              onClick={() => navigate(`/clients/${client.id}`)}
                            >
                              {client.client_name}
                            </TableCell>
                            <TableCell>{client.loan_officer}</TableCell>
                            <TableCell>{client.phone_number}</TableCell>
                            <TableCell>
                              {client.last_loan_date === "No loans"
                                ? "No loans"
                                : new Date(client.last_loan_date).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <span className={client.days_without_loan >= 30 ? "text-destructive font-semibold" : "font-medium"}>
                                {client.days_without_loan} days
                              </span>
                            </TableCell>
                            <TableCell>{getCategoryBadge(client)}</TableCell>
                            <TableCell>
                              {client.category === "inactive" ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={activatingId === client.id}
                                  onClick={() => handleActivateInactive(client.id, client.client_name)}
                                >
                                  <UserCheck className="h-3.5 w-3.5 mr-1.5" />
                                  {activatingId === client.id ? "Activating..." : "Activate"}
                                </Button>
                              ) : (
                                <PostClientFeeDialog
                                  clientId={client.id}
                                  clientName={client.client_name}
                                  onFeePosted={fetchData}
                                />
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </ReportPage>
  );
};

export default DormantClientsReport;
