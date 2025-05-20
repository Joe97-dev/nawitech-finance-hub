
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/layout";
import { Button } from "@/components/ui/button";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Phone, Mail, MapPin, Calendar, User, CreditCard, FileText } from "lucide-react";

// Sample client data with loan history
const clientsData = [
  { 
    id: "1", 
    name: "Jane Cooper", 
    phone: "(254) 555-0111", 
    email: "jane@example.com", 
    address: "Nairobi, Kenya",
    status: "active",
    idNumber: "12345678",
    dob: "1985-04-12",
    gender: "Female",
    occupation: "Teacher",
    monthlyIncome: 45000,
    branch: "Head Office",
    registrationDate: "2024-01-15",
    photoUrl: "",
    loans: [
      { id: 101, amount: 50000, disbursedDate: "2024-02-10", dueDate: "2024-08-10", status: "active", interestRate: 15, loanOfficer: "James Maina", repayments: [
        { date: "2024-03-10", amount: 9500 },
        { date: "2024-04-10", amount: 9500 }
      ] },
      { id: 102, amount: 30000, disbursedDate: "2023-06-05", dueDate: "2023-12-05", status: "closed", interestRate: 15, loanOfficer: "James Maina", repayments: [
        { date: "2023-07-05", amount: 5700 },
        { date: "2023-08-05", amount: 5700 },
        { date: "2023-09-05", amount: 5700 },
        { date: "2023-10-05", amount: 5700 },
        { date: "2023-11-05", amount: 5700 },
        { date: "2023-12-05", amount: 5700 }
      ] }
    ]
  },
  { 
    id: "2", 
    name: "Wade Warren", 
    phone: "(254) 555-0222", 
    email: "wade@example.com", 
    address: "Nakuru, Kenya",
    status: "active",
    idNumber: "23456789",
    dob: "1978-08-24",
    gender: "Male",
    occupation: "Businessman",
    monthlyIncome: 65000,
    branch: "Nakuru Branch",
    registrationDate: "2023-11-20",
    photoUrl: "",
    loans: [
      { id: 103, amount: 70000, disbursedDate: "2023-12-15", dueDate: "2024-06-15", status: "active", interestRate: 15, loanOfficer: "Joseph Kirui", repayments: [
        { date: "2024-01-15", amount: 13250 },
        { date: "2024-02-15", amount: 13250 },
        { date: "2024-03-15", amount: 13250 },
        { date: "2024-04-15", amount: 13250 }
      ] }
    ]
  },
  { 
    id: "3", 
    name: "Esther Howard", 
    phone: "(254) 555-0333", 
    email: "esther@example.com", 
    address: "Mombasa, Kenya",
    status: "inactive",
    idNumber: "34567890",
    dob: "1990-03-08",
    gender: "Female",
    occupation: "Shopkeeper",
    monthlyIncome: 30000,
    branch: "Mombasa Branch",
    registrationDate: "2023-09-05",
    photoUrl: "",
    loans: []
  },
  { 
    id: "4", 
    name: "Cameron Williamson", 
    phone: "(254) 555-0444", 
    email: "cameron@example.com", 
    address: "Kisumu, Kenya",
    status: "active",
    idNumber: "45678901",
    dob: "1983-12-15",
    gender: "Male",
    occupation: "Doctor",
    monthlyIncome: 120000,
    branch: "Kisumu Branch",
    registrationDate: "2023-10-10",
    photoUrl: "",
    loans: [
      { id: 104, amount: 100000, disbursedDate: "2023-11-01", dueDate: "2024-05-01", status: "closed", interestRate: 15, loanOfficer: "Susan Achieng", repayments: [
        { date: "2023-12-01", amount: 19000 },
        { date: "2024-01-01", amount: 19000 },
        { date: "2024-02-01", amount: 19000 },
        { date: "2024-03-01", amount: 19000 },
        { date: "2024-04-01", amount: 19000 },
        { date: "2024-05-01", amount: 19000 }
      ] },
      { id: 105, amount: 50000, disbursedDate: "2024-02-15", dueDate: "2024-08-15", status: "active", interestRate: 15, loanOfficer: "Susan Achieng", repayments: [
        { date: "2024-03-15", amount: 9500 },
        { date: "2024-04-15", amount: 9500 }
      ] }
    ]
  }
];

const ClientDetailPage = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  
  // Find client by ID
  const client = clientsData.find(c => c.id === clientId);
  
  if (!client) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
          <h2 className="text-2xl font-bold">Client Not Found</h2>
          <p className="text-muted-foreground">The client you're looking for doesn't exist or has been removed.</p>
          <Button onClick={() => navigate("/clients")}>Go Back to Clients</Button>
        </div>
      </DashboardLayout>
    );
  }
  
  const activeLoans = client.loans.filter(loan => loan.status === "active");
  const closedLoans = client.loans.filter(loan => loan.status === "closed");
  const totalLoanAmount = client.loans.reduce((acc, loan) => acc + loan.amount, 0);
  
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/clients")}
              className="mr-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Clients
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{client.name}</h1>
              <p className="text-muted-foreground">Client ID: {clientId}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline">Edit Client</Button>
            <Button>New Loan</Button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Client Information</CardTitle>
                <CardDescription>Personal and contact details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col items-center">
                  <Avatar className="h-24 w-24">
                    <AvatarFallback className="text-2xl">{client.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                    {client.photoUrl && <AvatarImage src={client.photoUrl} alt={client.name} />}
                  </Avatar>
                  
                  <div className="mt-3 text-center">
                    <h3 className="font-semibold text-lg">{client.name}</h3>
                    <Badge variant={client.status === "active" ? "default" : "outline"} className="mt-1">
                      {client.status}
                    </Badge>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{client.phone}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{client.email}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{client.address}</span>
                  </div>
                </div>
                
                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">ID Number</span>
                    <span className="font-medium">{client.idNumber}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Date of Birth</span>
                    <span className="font-medium">{client.dob}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Gender</span>
                    <span className="font-medium">{client.gender}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Branch</span>
                    <span className="font-medium">{client.branch}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Registration Date</span>
                    <span className="font-medium">{client.registrationDate}</span>
                  </div>
                </div>
                
                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Occupation</span>
                    <span className="font-medium">{client.occupation}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Monthly Income</span>
                    <span className="font-medium">KES {client.monthlyIncome.toLocaleString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="md:col-span-2">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Loan History</CardTitle>
                <CardDescription>
                  {client.loans.length > 0 
                    ? `${client.loans.length} loans, total value: KES ${totalLoanAmount.toLocaleString()}`
                    : "No loans found for this client"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="active" className="h-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="active">
                      Active Loans ({activeLoans.length})
                    </TabsTrigger>
                    <TabsTrigger value="closed">
                      Closed Loans ({closedLoans.length})
                    </TabsTrigger>
                    <TabsTrigger value="all">
                      All Loans ({client.loans.length})
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="active" className="h-full">
                    {activeLoans.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Loan ID</TableHead>
                            <TableHead>Amount (KES)</TableHead>
                            <TableHead>Disbursed</TableHead>
                            <TableHead>Due Date</TableHead>
                            <TableHead>Interest Rate</TableHead>
                            <TableHead>Loan Officer</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {activeLoans.map(loan => (
                            <TableRow key={loan.id}>
                              <TableCell className="font-medium">{loan.id}</TableCell>
                              <TableCell>{loan.amount.toLocaleString()}</TableCell>
                              <TableCell>{loan.disbursedDate}</TableCell>
                              <TableCell>{loan.dueDate}</TableCell>
                              <TableCell>{loan.interestRate}%</TableCell>
                              <TableCell>{loan.loanOfficer}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-48 text-center">
                        <CreditCard className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-medium">No Active Loans</h3>
                        <p className="text-muted-foreground mt-1">This client has no active loans at the moment.</p>
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="closed" className="h-full">
                    {closedLoans.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Loan ID</TableHead>
                            <TableHead>Amount (KES)</TableHead>
                            <TableHead>Disbursed</TableHead>
                            <TableHead>Closed</TableHead>
                            <TableHead>Interest Rate</TableHead>
                            <TableHead>Loan Officer</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {closedLoans.map(loan => (
                            <TableRow key={loan.id}>
                              <TableCell className="font-medium">{loan.id}</TableCell>
                              <TableCell>{loan.amount.toLocaleString()}</TableCell>
                              <TableCell>{loan.disbursedDate}</TableCell>
                              <TableCell>{loan.dueDate}</TableCell>
                              <TableCell>{loan.interestRate}%</TableCell>
                              <TableCell>{loan.loanOfficer}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-48 text-center">
                        <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-medium">No Closed Loans</h3>
                        <p className="text-muted-foreground mt-1">This client has no closed loans in the record.</p>
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="all" className="h-full">
                    {client.loans.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Loan ID</TableHead>
                            <TableHead>Amount (KES)</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Disbursed</TableHead>
                            <TableHead>Due Date</TableHead>
                            <TableHead>Interest Rate</TableHead>
                            <TableHead>Loan Officer</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {client.loans.map(loan => (
                            <TableRow key={loan.id}>
                              <TableCell className="font-medium">{loan.id}</TableCell>
                              <TableCell>{loan.amount.toLocaleString()}</TableCell>
                              <TableCell>
                                <Badge variant={loan.status === "active" ? "default" : "secondary"}>
                                  {loan.status}
                                </Badge>
                              </TableCell>
                              <TableCell>{loan.disbursedDate}</TableCell>
                              <TableCell>{loan.dueDate}</TableCell>
                              <TableCell>{loan.interestRate}%</TableCell>
                              <TableCell>{loan.loanOfficer}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-48 text-center">
                        <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-medium">No Loan History</h3>
                        <p className="text-muted-foreground mt-1">This client has not taken any loans yet.</p>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ClientDetailPage;
