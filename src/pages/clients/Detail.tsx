
import { useState, useEffect } from "react";
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
import { ArrowLeft, Phone, Mail, MapPin, Calendar, CreditCard, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Loan {
  id: string;
  amount: number;
  date: string;
  status: string;
  type: string;
  balance: number;
}

interface Client {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  status: string;
  id_number: string;
  date_of_birth: string | null;
  gender: string | null;
  occupation: string | null;
  monthly_income: number | null;
  branch_id: string | null;
  registration_date: string | null;
  photo_url: string | null;
  employment_status: string | null;
  loans: Loan[];
}

const ClientDetailPage = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchClientData = async () => {
      if (!clientId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        // Fetch client data from Supabase
        const { data: clientData, error: clientError } = await supabase
          .from('clients')
          .select('*')
          .eq('id', clientId)
          .single();
        
        if (clientError) {
          console.error("Error fetching client:", clientError);
          throw clientError;
        }
        
        // Fetch loans for this client
        const clientName = `${clientData.first_name} ${clientData.last_name}`;
        const { data: loansData, error: loansError } = await supabase
          .from('loans')
          .select('*')
          .eq('client', clientName);
        
        if (loansError) {
          console.error("Error fetching loans:", loansError);
          // Don't throw here, just log the error and continue without loans
        }
        
        // Combine client data with loans
        const enrichedClient = {
          ...clientData,
          loans: loansData || []
        };
        
        setClient(enrichedClient);
        
      } catch (error: any) {
        console.error("Error fetching client details:", error);
        toast({
          variant: "destructive",
          title: "Error loading client",
          description: error.message || "Failed to load client details"
        });
        setClient(null);
      } finally {
        setLoading(false);
      }
    };
    
    fetchClientData();
  }, [clientId, toast]);
  
  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            <p>Loading client details...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }
  
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
  
  const getFullName = () => `${client.first_name} ${client.last_name}`;
  const getFullAddress = () => {
    const parts = [client.address, client.city, client.region].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : 'Not specified';
  };
  
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
              <h1 className="text-3xl font-bold tracking-tight">{getFullName()}</h1>
              <p className="text-muted-foreground">Client ID: {clientId}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline">Edit Client</Button>
            <Button onClick={() => navigate("/loans/new")}>New Loan</Button>
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
                    <AvatarFallback className="text-2xl">{client.first_name[0]}{client.last_name[0]}</AvatarFallback>
                    {client.photo_url && <AvatarImage src={client.photo_url} alt={getFullName()} />}
                  </Avatar>
                  
                  <div className="mt-3 text-center">
                    <h3 className="font-semibold text-lg">{getFullName()}</h3>
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
                    <span>{client.email || "Not provided"}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{getFullAddress()}</span>
                  </div>
                </div>
                
                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">ID Number</span>
                    <span className="font-medium">{client.id_number}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Date of Birth</span>
                    <span className="font-medium">{client.date_of_birth || "Not specified"}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Gender</span>
                    <span className="font-medium">{client.gender || "Not specified"}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Registration Date</span>
                    <span className="font-medium">{client.registration_date || "Not specified"}</span>
                  </div>
                </div>
                
                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Occupation</span>
                    <span className="font-medium">{client.occupation || "Not specified"}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Monthly Income</span>
                    <span className="font-medium">
                      {client.monthly_income ? `KES ${client.monthly_income.toLocaleString()}` : "Not specified"}
                    </span>
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
                            <TableHead>Balance (KES)</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Type</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {activeLoans.map(loan => (
                            <TableRow key={loan.id} className="cursor-pointer" onClick={() => navigate(`/loans/${loan.id}`)}>
                              <TableCell className="font-medium text-primary underline">{loan.id.substring(0, 8)}...</TableCell>
                              <TableCell>{loan.amount.toLocaleString()}</TableCell>
                              <TableCell>{loan.balance.toLocaleString()}</TableCell>
                              <TableCell>{loan.date}</TableCell>
                              <TableCell>{loan.type}</TableCell>
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
                            <TableHead>Balance (KES)</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Type</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {closedLoans.map(loan => (
                            <TableRow key={loan.id} className="cursor-pointer" onClick={() => navigate(`/loans/${loan.id}`)}>
                              <TableCell className="font-medium text-primary underline">{loan.id.substring(0, 8)}...</TableCell>
                              <TableCell>{loan.amount.toLocaleString()}</TableCell>
                              <TableCell>{loan.balance.toLocaleString()}</TableCell>
                              <TableCell>{loan.date}</TableCell>
                              <TableCell>{loan.type}</TableCell>
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
                            <TableHead>Balance (KES)</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Type</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {client.loans.map(loan => (
                            <TableRow key={loan.id} className="cursor-pointer" onClick={() => navigate(`/loans/${loan.id}`)}>
                              <TableCell className="font-medium text-primary underline">{loan.id.substring(0, 8)}...</TableCell>
                              <TableCell>{loan.amount.toLocaleString()}</TableCell>
                              <TableCell>{loan.balance.toLocaleString()}</TableCell>
                              <TableCell>
                                <Badge variant={loan.status === "active" ? "default" : "secondary"}>
                                  {loan.status}
                                </Badge>
                              </TableCell>
                              <TableCell>{loan.date}</TableCell>
                              <TableCell>{loan.type}</TableCell>
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
