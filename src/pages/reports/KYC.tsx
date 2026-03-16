import { useState, useEffect, useMemo } from "react";
import { ReportPage } from "./Base";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ExportButton } from "@/components/ui/export-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, AlertCircle } from "lucide-react";

interface Client {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  id_number: string;
  date_of_birth: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  gender: string | null;
  branch_id: string | null;
  status: string;
  photo_url: string | null;
  registration_date: string | null;
  id_photo_front_url: string | null;
  id_photo_back_url: string | null;
  business_photo_url: string | null;
  occupation: string | null;
  marital_status: string | null;
  loans?: Loan[];
  effectiveStatus?: string;
  kycScore?: number;
  missingFields?: string[];
}

interface Loan {
  id: string;
  loan_number: string | null;
  amount: number;
  status: string;
  date: string;
  type: string;
  client: string;
}

interface Branch {
  id: string;
  name: string;
}

const statusOptions = [
  { value: "all", label: "All Status" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "dormant", label: "Dormant" }
];

const columns = [
  { key: "clientName", header: "Client Name" },
  { key: "phoneNumber", header: "Phone Number" },
  { key: "idNumber", header: "ID Number" },
  { key: "gender", header: "Gender" },
  { key: "dob", header: "Date of Birth" },
  { key: "address", header: "Address" },
  { key: "branch", header: "Branch" },
  { key: "status", header: "Status" },
  { key: "kycScore", header: "KYC Completeness (%)" },
  { key: "registrationDate", header: "Registration Date" }
];

// KYC completeness checker
const KYC_FIELDS: { key: keyof Client; label: string }[] = [
  { key: "phone", label: "Phone Number" },
  { key: "id_number", label: "ID Number" },
  { key: "date_of_birth", label: "Date of Birth" },
  { key: "gender", label: "Gender" },
  { key: "address", label: "Address" },
  { key: "city", label: "City" },
  { key: "region", label: "Region" },
  { key: "photo_url", label: "Passport Photo" },
  { key: "id_photo_front_url", label: "ID Photo (Front)" },
  { key: "id_photo_back_url", label: "ID Photo (Back)" },
  { key: "occupation", label: "Occupation" },
  { key: "marital_status", label: "Marital Status" },
];

const computeKyc = (client: Client) => {
  const missing: string[] = [];
  KYC_FIELDS.forEach(f => {
    const val = client[f.key];
    if (!val || (typeof val === "string" && val.trim() === "")) {
      missing.push(f.label);
    }
  });
  const score = Math.round(((KYC_FIELDS.length - missing.length) / KYC_FIELDS.length) * 100);
  return { score, missing };
};

// Loan-to-client matching (UUID or name)
const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const matchLoansToClient = (client: Client, loans: Loan[]) =>
  loans.filter(l =>
    l.client === client.id ||
    normalize(l.client) === normalize(`${client.first_name} ${client.last_name}`)
  );

const hasOpenLoan = (clientLoans: Loan[]) =>
  clientLoans.some(l => !["closed", "rejected", "written_off"].includes(l.status));

const KYCReport = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch all data once — no dependency on selectedClient
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Paginated client fetch to handle >1000 rows
        let allClients: any[] = [];
        let from = 0;
        const pageSize = 1000;
        while (true) {
          const { data, error } = await supabase
            .from("clients")
            .select("*")
            .range(from, from + pageSize - 1)
            .order("first_name");
          if (error) throw error;
          allClients = allClients.concat(data || []);
          if (!data || data.length < pageSize) break;
          from += pageSize;
        }

        // Fetch loans and branches in parallel
        const [loansRes, branchesRes] = await Promise.all([
          supabase.from("loans").select("id, loan_number, amount, status, date, type, client").neq("type", "client_fee_account"),
          supabase.from("branches").select("id, name"),
        ]);

        if (loansRes.error) throw loansRes.error;
        const loansData = loansRes.data || [];
        setBranches(branchesRes.data || []);
        setLoans(loansData);

        // Enhance clients with loans, effective status, KYC score
        const enhanced: Client[] = allClients.map((client: Client) => {
          const clientLoans = matchLoansToClient(client, loansData);
          const effectiveStatus = hasOpenLoan(clientLoans) ? "active" : (client.status || "active");
          const { score, missing } = computeKyc(client);
          return {
            ...client,
            loans: clientLoans,
            effectiveStatus,
            kycScore: score,
            missingFields: missing,
          };
        });

        setClients(enhanced);
        if (enhanced.length > 0) {
          setSelectedClient(prev => prev || enhanced[0].id);
        }
      } catch (error: any) {
        console.error("Error fetching KYC data:", error);
        toast({ variant: "destructive", title: "Data fetch error", description: "Failed to load KYC data." });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [toast]);

  // Filtered clients
  const filteredClients = useMemo(() =>
    clients.filter(client => {
      const matchesBranch = selectedBranch === "all" || client.branch_id === selectedBranch;
      const matchesStatus = selectedStatus === "all" || client.effectiveStatus === selectedStatus;
      const name = `${client.first_name} ${client.last_name}`;
      const matchesSearch =
        searchQuery === "" ||
        name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        client.phone.includes(searchQuery) ||
        client.id_number.includes(searchQuery);
      return matchesBranch && matchesStatus && matchesSearch;
    }),
    [clients, selectedBranch, selectedStatus, searchQuery]
  );

  const selectedClientData = clients.find(c => c.id === selectedClient);
  const getFullName = (c: Client) => `${c.first_name} ${c.last_name}`;

  const branchName = (branchId: string | null) =>
    branchId ? branches.find(b => b.id === branchId)?.name || "—" : "—";

  return (
    <ReportPage
      title="KYC Report"
      description="Comprehensive client information, KYC completeness, and loan history"
      actions={
        <div className="flex flex-col gap-2 w-full">
          <div className="flex flex-col sm:flex-row items-center gap-2 w-full">
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Select Branch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {branches.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Client Status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              placeholder="Search by name, ID or phone"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full sm:w-auto flex-1"
            />

            <ExportButton
              data={filteredClients.map(client => ({
                clientName: getFullName(client),
                phoneNumber: client.phone,
                idNumber: client.id_number,
                gender: client.gender || "Not specified",
                dob: client.date_of_birth || "Not specified",
                address: client.address || "Not specified",
                branch: branchName(client.branch_id),
                status: client.effectiveStatus || client.status,
                kycScore: client.kycScore ?? 0,
                registrationDate: client.registration_date || "Not specified",
              }))}
              filename={`kyc-report-${new Date().toISOString().slice(0, 10)}`}
              columns={columns}
            />
          </div>
        </div>
      }
    >
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-1 space-y-4">
              <Card>
                <CardContent className="p-4">
                  <div className="font-medium">Total Clients</div>
                  <div className="text-2xl font-bold">{filteredClients.length}</div>
                  <div className="text-sm text-muted-foreground">
                    Active: {filteredClients.filter(c => c.effectiveStatus === "active").length} |
                    Inactive: {filteredClients.filter(c => c.effectiveStatus === "inactive").length} |
                    Dormant: {filteredClients.filter(c => c.effectiveStatus === "dormant").length}
                  </div>
                </CardContent>
              </Card>

              <ScrollArea className="h-[500px] border rounded-md">
                <div className="p-4">
                  <h3 className="text-sm font-medium mb-3">Client List</h3>
                  <div className="space-y-2">
                    {filteredClients.length === 0 ? (
                      <div className="text-center py-4 text-muted-foreground">No clients match your criteria</div>
                    ) : (
                      filteredClients.map(client => (
                        <Card
                          key={client.id}
                          className={`cursor-pointer ${selectedClient === client.id ? "border-primary" : ""}`}
                          onClick={() => setSelectedClient(client.id)}
                        >
                          <CardContent className="p-3 flex items-center gap-3">
                            <Avatar>
                              <AvatarImage src={client.photo_url || undefined} />
                              <AvatarFallback>{client.first_name[0]}{client.last_name[0]}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{getFullName(client)}</div>
                              <div className="text-xs text-muted-foreground flex items-center gap-2">
                                <span>{client.phone}</span>
                                <span className={client.kycScore === 100 ? "text-green-600" : "text-amber-600"}>
                                  {client.kycScore}% KYC
                                </span>
                              </div>
                            </div>
                            <Badge className="ml-auto shrink-0" variant={client.effectiveStatus === "active" ? "default" : "outline"}>
                              {client.effectiveStatus}
                            </Badge>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </div>
              </ScrollArea>
            </div>

            <div className="lg:col-span-2">
              {selectedClientData ? (
                <ClientDetail
                  client={selectedClientData}
                  branchName={branchName(selectedClientData.branch_id)}
                  onLoanClick={loanId => navigate(`/loans/${loanId}`)}
                />
              ) : (
                <div className="border rounded-md flex items-center justify-center h-full p-8 text-muted-foreground">
                  {filteredClients.length > 0 ? "Select a client to view their details" : "No clients available"}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </ReportPage>
  );
};

const ClientDetail = ({
  client,
  branchName,
  onLoanClick,
}: {
  client: Client;
  branchName: string;
  onLoanClick: (loanId: string) => void;
}) => {
  const kycScore = client.kycScore ?? 0;
  const missingFields = client.missingFields ?? [];

  return (
    <Card>
      <CardContent className="p-6">
        <Tabs defaultValue="personal">
          <TabsList className="mb-4">
            <TabsTrigger value="personal">Personal Info</TabsTrigger>
            <TabsTrigger value="kyc">KYC Status</TabsTrigger>
            <TabsTrigger value="loans">Loan History ({client.loans?.length || 0})</TabsTrigger>
          </TabsList>

          <TabsContent value="personal">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center gap-4 mb-6">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={client.photo_url || undefined} />
                    <AvatarFallback className="text-lg">{client.first_name[0]}{client.last_name[0]}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-xl font-semibold">{client.first_name} {client.last_name}</h3>
                    <Badge variant={client.effectiveStatus === "active" ? "default" : "outline"} className="mt-1">
                      {client.effectiveStatus}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-3">
                  <DetailRow label="Phone Number" value={client.phone} />
                  <DetailRow label="ID Number" value={client.id_number} />
                  <DetailRow label="Date of Birth" value={client.date_of_birth} />
                  <DetailRow label="Gender" value={client.gender} />
                  <DetailRow label="Marital Status" value={client.marital_status} />
                  <DetailRow label="Occupation" value={client.occupation} />
                </div>
              </div>
              <div className="space-y-3">
                <DetailRow label="Physical Address" value={client.address} />
                <DetailRow label="City" value={client.city} />
                <DetailRow label="Region" value={client.region} />
                <DetailRow label="Branch" value={branchName} />
                <DetailRow label="Registration Date" value={client.registration_date} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="kyc">
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">KYC Completeness</span>
                    <span className={`text-sm font-bold ${kycScore === 100 ? "text-green-600" : kycScore >= 70 ? "text-amber-600" : "text-destructive"}`}>
                      {kycScore}%
                    </span>
                  </div>
                  <Progress value={kycScore} className="h-3" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {KYC_FIELDS.map(f => {
                  const val = client[f.key];
                  const filled = val && (typeof val !== "string" || val.trim() !== "");
                  return (
                    <div key={f.key} className="flex items-center gap-2 p-2 rounded-md border">
                      {filled ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                      )}
                      <span className={`text-sm ${filled ? "" : "text-destructive font-medium"}`}>{f.label}</span>
                    </div>
                  );
                })}
              </div>

              {missingFields.length > 0 && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
                  <p className="text-sm font-medium text-destructive mb-1">Missing Information ({missingFields.length})</p>
                  <p className="text-sm text-muted-foreground">{missingFields.join(", ")}</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="loans">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="font-medium">Total Loans: {client.loans?.length || 0}</div>
                <div className="text-sm text-muted-foreground">
                  Active: {client.loans?.filter(l => l.status === "active" || l.status === "in arrears" || l.status === "disbursed").length || 0} |
                  Closed: {client.loans?.filter(l => l.status === "closed").length || 0}
                </div>
              </div>

              {!client.loans || client.loans.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border rounded-md">No loans found for this client</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Loan #</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {client.loans.map(loan => (
                      <TableRow key={loan.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onLoanClick(loan.id)}>
                        <TableCell className="font-medium text-primary underline">{loan.loan_number || loan.id.substring(0, 8)}</TableCell>
                        <TableCell>KES {loan.amount.toLocaleString()}</TableCell>
                        <TableCell>{loan.date}</TableCell>
                        <TableCell>{loan.type}</TableCell>
                        <TableCell>
                          <Badge variant={["active", "in arrears", "disbursed"].includes(loan.status) ? "default" : "secondary"}>
                            {loan.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

const DetailRow = ({ label, value }: { label: string; value: string | null | undefined }) => (
  <div>
    <div className="text-sm text-muted-foreground">{label}</div>
    <div>{value || "Not specified"}</div>
  </div>
);

export default KYCReport;
