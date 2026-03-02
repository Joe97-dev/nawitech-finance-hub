import { useState, useEffect } from "react";
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
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Client {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  id_number: string;
  date_of_birth: string | null;  // Changed from dob to date_of_birth to match Supabase schema
  address: string | null;
  city: string | null;
  region: string | null;
  gender: string | null;
  branch_id: string | null;
  status: string;
  photo_url: string | null;
  registration_date: string | null;  // Added registration_date property to match usage
  loans?: Loan[];
}

interface Loan {
  id: string;
  amount: number;
  status: string;
  date: string;
  type: string;
}

const branches = [
  { value: "all", label: "All Branches" },
  { value: "head-office", label: "HEAD OFFICE" },
  { value: "westlands", label: "Westlands Branch" },
  { value: "mombasa", label: "Mombasa Branch" },
  { value: "kisumu", label: "Kisumu Branch" },
  { value: "nakuru", label: "Nakuru Branch" }
];

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
  { key: "registrationDate", header: "Registration Date" }
];

const KYCReport = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Fetch clients and loans from Supabase
  useEffect(() => {
    const fetchClientsAndLoans = async () => {
      try {
        setLoading(true);
        
        // Fetch clients
        const { data: clientsData, error: clientsError } = await supabase
          .from('clients')
          .select('*');
        
        if (clientsError) throw clientsError;
        
        // Fetch loans
        const { data: loansData, error: loansError } = await supabase
          .from('loans')
          .select('*')
          .neq('type', 'client_fee_account');
          
        if (loansError) throw loansError;
        
        // Map loans to clients
        const enhancedClients = (clientsData || []).map((client: any) => {
          // Match loans with clients based on client name
          // This is a temporary solution until we have a proper client_id in loans table
          const clientName = `${client.first_name} ${client.last_name}`;
          const clientLoans = (loansData || []).filter(
            (loan: any) => loan.client === clientName
          );
          
          return {
            ...client,
            loans: clientLoans || []
          };
        });
        
        setClients(enhancedClients);
        setLoans(loansData || []);
        
        // Select first client by default if available
        if (enhancedClients.length > 0 && !selectedClient) {
          setSelectedClient(enhancedClients[0].id);
        }
      } catch (error: any) {
        console.error("Error fetching clients and loans:", error);
        toast({
          variant: "destructive",
          title: "Data fetch error",
          description: "Failed to load clients and loans data."
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchClientsAndLoans();
  }, [toast, selectedClient]);
  
  // Filter clients based on selected branch, status and search query
  const filteredClients = clients.filter(client => {
    const matchesBranch = selectedBranch === "all" || client.branch_id === selectedBranch;
    const matchesStatus = selectedStatus === "all" || client.status === selectedStatus;
    
    // Check if client matches search query
    const clientName = `${client.first_name} ${client.last_name}`;
    const matchesSearch = searchQuery === "" || 
                         clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         client.phone.includes(searchQuery) ||
                         client.id_number.includes(searchQuery) ||
                         (client.email && client.email.toLowerCase().includes(searchQuery.toLowerCase()));
    
    return matchesBranch && matchesStatus && matchesSearch;
  });
  
  // Get selected client data
  const selectedClientData = clients.find(c => c.id === selectedClient);

  // Helper function to get full name
  const getFullName = (client: Client) => `${client.first_name} ${client.last_name}`;
  
  return (
    <ReportPage
      title="KYC Report"
      description="Comprehensive client information and loan history"
      actions={
        <div className="flex flex-col gap-2 w-full">
          <div className="flex flex-col sm:flex-row items-center gap-2 w-full">
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Select Branch" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((branch) => (
                  <SelectItem key={branch.value} value={branch.value}>
                    {branch.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Client Status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Input 
              placeholder="Search by name, ID or phone" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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
                branch: getBranchLabel(client.branch_id),
                status: client.status,
                registrationDate: client.registration_date || "Not specified"
              }))} 
              filename={`kyc-report-${selectedBranch}-${new Date().toISOString().slice(0, 10)}`} 
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
                    Active: {filteredClients.filter(c => c.status === 'active').length} | 
                    Inactive: {filteredClients.filter(c => c.status === 'inactive').length} | 
                    Dormant: {filteredClients.filter(c => c.status === 'dormant').length}
                  </div>
                </CardContent>
              </Card>
              
              <ScrollArea className="h-[500px] border rounded-md">
                <div className="p-4">
                  <h3 className="text-sm font-medium mb-3">Client List</h3>
                  <div className="space-y-2">
                    {filteredClients.length === 0 ? (
                      <div className="text-center py-4 text-muted-foreground">
                        No clients match your criteria
                      </div>
                    ) : (
                      filteredClients.map(client => (
                        <Card 
                          key={client.id} 
                          className={`cursor-pointer ${selectedClient === client.id ? 'border-primary' : ''}`}
                          onClick={() => setSelectedClient(client.id)}
                        >
                          <CardContent className="p-3 flex items-center gap-3">
                            <Avatar>
                              <AvatarImage src={client.photo_url || undefined} />
                              <AvatarFallback>{client.first_name[0]}{client.last_name[0]}</AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">{getFullName(client)}</div>
                              <div className="text-sm text-muted-foreground">{client.phone}</div>
                            </div>
                            <Badge className="ml-auto" variant={client.status === 'active' ? 'default' : 'outline'}>
                              {client.status}
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
                  onLoanClick={(loanId) => navigate(`/loans/${loanId}`)}
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

// Helper function to get branch label
const getBranchLabel = (branch_id: string | null) => {
  if (!branch_id) return "Not assigned";
  
  // In a real implementation, you would fetch branch names from your database
  // For now, we'll return a placeholder
  return "Branch";
};

// Updated ClientDetail component to handle loan navigation
const ClientDetail = ({ 
  client, 
  onLoanClick 
}: { 
  client: Client, 
  onLoanClick: (loanId: string) => void 
}) => {
  return (
    <Card>
      <CardContent className="p-6">
        <Tabs defaultValue="personal">
          <TabsList className="mb-4">
            <TabsTrigger value="personal">Personal Info</TabsTrigger>
            <TabsTrigger value="loans">Loan History</TabsTrigger>
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
                    <Badge variant={client.status === 'active' ? 'default' : 'outline'} className="mt-1">
                      {client.status}
                    </Badge>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <div className="text-sm text-muted-foreground">Phone Number</div>
                    <div>{client.phone}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">ID Number</div>
                    <div>{client.id_number}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Date of Birth</div>
                    <div>{client.date_of_birth || "Not specified"}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Gender</div>
                    <div>{client.gender || "Not specified"}</div>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <div>
                  <div className="text-sm text-muted-foreground">Physical Address</div>
                  <div>{client.address || "Not specified"}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">City</div>
                  <div>{client.city || "Not specified"}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Region</div>
                  <div>{client.region || "Not specified"}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Registration Date</div>
                  <div>{client.registration_date || "Not specified"}</div>
                </div>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="loans">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="font-medium">Total Loans: {client.loans?.length || 0}</div>
                <div className="text-sm text-muted-foreground">
                  Active: {client.loans?.filter(loan => loan.status === 'active').length || 0} | 
                  Closed: {client.loans?.filter(loan => loan.status === 'closed').length || 0}
                </div>
              </div>
              
              {!client.loans || client.loans.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border rounded-md">
                  No loans found for this client
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Loan ID</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {client.loans.map((loan) => (
                      <TableRow 
                        key={loan.id} 
                        className="cursor-pointer hover:bg-muted"
                        onClick={() => onLoanClick(loan.id)}
                      >
                        <TableCell className="font-medium text-primary underline">{loan.id.substring(0, 8)}...</TableCell>
                        <TableCell>KES {loan.amount.toLocaleString()}</TableCell>
                        <TableCell>{loan.date}</TableCell>
                        <TableCell>{loan.type}</TableCell>
                        <TableCell>
                          <Badge variant={loan.status === 'active' ? 'default' : 'secondary'}>
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

export default KYCReport;
