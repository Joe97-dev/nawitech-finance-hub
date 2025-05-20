
import { useState } from "react";
import { ReportPage } from "./Base";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ExportButton } from "@/components/ui/export-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

// Dummy data for KYC reports
const clientsData = [
  { 
    id: 1, 
    clientName: "John Kamau", 
    phoneNumber: "0712345678", 
    idNumber: "12345678", 
    dob: "1985-05-15",
    email: "john@example.com",
    address: "123 Kimathi St, Nairobi",
    gender: "Male",
    branch: "head-office",
    status: "active",
    registrationDate: "2024-01-15",
    photoUrl: "",
    loans: [
      { id: 101, amount: 50000, disbursedDate: "2024-02-10", status: "active", dueDate: "2025-08-10" },
      { id: 102, amount: 25000, disbursedDate: "2023-10-05", status: "closed", dueDate: "2024-04-05" }
    ]
  },
  { 
    id: 2, 
    clientName: "Mary Wanjiku", 
    phoneNumber: "0723456789", 
    idNumber: "23456789", 
    dob: "1990-08-22",
    email: "mary@example.com",
    address: "456 Moi Ave, Nairobi",
    gender: "Female",
    branch: "head-office",
    status: "active",
    registrationDate: "2024-02-20",
    photoUrl: "",
    loans: [
      { id: 103, amount: 35000, disbursedDate: "2024-03-15", status: "active", dueDate: "2025-09-15" }
    ]
  },
  { 
    id: 3, 
    clientName: "Peter Ochieng", 
    phoneNumber: "0734567890", 
    idNumber: "34567890", 
    dob: "1982-11-30",
    email: "peter@example.com",
    address: "789 Tom Mboya St, Nairobi",
    gender: "Male",
    branch: "westlands",
    status: "inactive",
    registrationDate: "2023-11-10",
    photoUrl: "",
    loans: [
      { id: 104, amount: 20000, disbursedDate: "2023-12-05", status: "closed", dueDate: "2024-06-05" },
      { id: 105, amount: 40000, disbursedDate: "2024-01-20", status: "closed", dueDate: "2024-07-20" }
    ]
  },
  { 
    id: 4, 
    clientName: "Lucy Muthoni", 
    phoneNumber: "0745678901", 
    idNumber: "45678901", 
    dob: "1988-04-12",
    email: "lucy@example.com",
    address: "101 Kenyatta Ave, Mombasa",
    gender: "Female",
    branch: "mombasa",
    status: "dormant",
    registrationDate: "2023-08-05",
    photoUrl: "",
    loans: []
  },
  { 
    id: 5, 
    clientName: "David Kiprop", 
    phoneNumber: "0756789012", 
    idNumber: "56789012", 
    dob: "1995-02-18",
    email: "david@example.com",
    address: "202 Oginga Odinga St, Kisumu",
    gender: "Male",
    branch: "kisumu",
    status: "active",
    registrationDate: "2023-09-25",
    photoUrl: "",
    loans: [
      { id: 106, amount: 30000, disbursedDate: "2023-10-15", status: "active", dueDate: "2025-04-15" }
    ]
  }
];

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
  { key: "email", header: "Email" },
  { key: "address", header: "Address" },
  { key: "branch", header: "Branch" },
  { key: "status", header: "Status" },
  { key: "registrationDate", header: "Registration Date" }
];

const KYCReport = () => {
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState<number | null>(null);
  
  // Filter data based on selected branch, status and search query
  const filteredClients = clientsData.filter(client => {
    const matchesBranch = selectedBranch === "all" || client.branch === selectedBranch;
    const matchesStatus = selectedStatus === "all" || client.status === selectedStatus;
    
    // Check if client matches search query
    const matchesSearch = searchQuery === "" || 
                         client.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         client.phoneNumber.includes(searchQuery) ||
                         client.idNumber.includes(searchQuery);
    
    return matchesBranch && matchesStatus && matchesSearch;
  });
  
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
                ...client,
                branch: branches.find(b => b.value === client.branch)?.label || client.branch,
                loans: undefined // Don't include loans in the export
              }))} 
              filename={`kyc-report-${selectedBranch}-${format(new Date(), 'yyyy-MM-dd')}`} 
              columns={columns} 
            />
          </div>
        </div>
      }
    >
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
                  {filteredClients.map(client => (
                    <Card 
                      key={client.id} 
                      className={`cursor-pointer ${selectedClient === client.id ? 'border-primary' : ''}`}
                      onClick={() => setSelectedClient(client.id)}
                    >
                      <CardContent className="p-3 flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback>{client.clientName.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{client.clientName}</div>
                          <div className="text-sm text-muted-foreground">{client.phoneNumber}</div>
                        </div>
                        <Badge className="ml-auto" variant={client.status === 'active' ? 'default' : 'outline'}>
                          {client.status}
                        </Badge>
                      </CardContent>
                    </Card>
                  ))}
                  {filteredClients.length === 0 && (
                    <div className="text-center py-4 text-muted-foreground">
                      No clients match your criteria
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          </div>
          
          <div className="lg:col-span-2">
            {selectedClient ? (
              <ClientDetail client={clientsData.find(c => c.id === selectedClient)!} />
            ) : (
              <div className="border rounded-md flex items-center justify-center h-full p-8 text-muted-foreground">
                Select a client to view their details
              </div>
            )}
          </div>
        </div>
      </div>
    </ReportPage>
  );
};

const ClientDetail = ({ client }: { client: typeof clientsData[0] }) => {
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
                    <AvatarFallback className="text-lg">{client.clientName.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-xl font-semibold">{client.clientName}</h3>
                    <Badge variant={client.status === 'active' ? 'default' : 'outline'} className="mt-1">
                      {client.status}
                    </Badge>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <div className="text-sm text-muted-foreground">Phone Number</div>
                    <div>{client.phoneNumber}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">ID Number</div>
                    <div>{client.idNumber}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Date of Birth</div>
                    <div>{client.dob}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Gender</div>
                    <div>{client.gender}</div>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <div>
                  <div className="text-sm text-muted-foreground">Email</div>
                  <div>{client.email}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Physical Address</div>
                  <div>{client.address}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Branch</div>
                  <div>{branches.find(b => b.value === client.branch)?.label || client.branch}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Registration Date</div>
                  <div>{client.registrationDate}</div>
                </div>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="loans">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="font-medium">Total Loans: {client.loans.length}</div>
                <div className="text-sm text-muted-foreground">
                  Active: {client.loans.filter(loan => loan.status === 'active').length} | 
                  Closed: {client.loans.filter(loan => loan.status === 'closed').length}
                </div>
              </div>
              
              {client.loans.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Loan ID</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Disbursed</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {client.loans.map((loan) => (
                      <TableRow key={loan.id}>
                        <TableCell>{loan.id}</TableCell>
                        <TableCell>KES {loan.amount.toLocaleString()}</TableCell>
                        <TableCell>{loan.disbursedDate}</TableCell>
                        <TableCell>{loan.dueDate}</TableCell>
                        <TableCell>
                          <Badge variant={loan.status === 'active' ? 'default' : 'secondary'}>
                            {loan.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground border rounded-md">
                  No loans found for this client
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default KYCReport;
