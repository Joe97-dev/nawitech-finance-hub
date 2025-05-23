
import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Plus, Search, FileUp, Download } from "lucide-react";
import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
  photo_url: string | null;
  id_number: string;
  gender: string | null;
  date_of_birth: string | null;
  branch_id: string | null;
  registration_date: string | null;
}

const ClientsPage = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  
  // Fetch clients from Supabase
  useEffect(() => {
    const fetchClients = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('clients')
          .select('*');
        
        if (error) {
          throw error;
        }
        
        // Ensure all client data is formatted correctly
        if (data) {
          console.log("Fetched clients:", data);
        }
        
        setClients(data || []);
      } catch (error: any) {
        console.error("Error fetching clients:", error);
        toast({
          variant: "destructive",
          title: "Failed to load clients",
          description: error.message || "There was an error loading the client list."
        });
      } finally {
        setLoading(false);
      }
    };

    fetchClients();
  }, [toast]);
  
  const filteredClients = clients.filter(client => 
    client.first_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    client.last_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    client.phone.includes(searchQuery) ||
    (client.email && client.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getFullName = (client: Client) => {
    return `${client.first_name} ${client.last_name}`;
  };

  const getFullAddress = (client: Client) => {
    const parts = [client.address, client.city, client.region].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : '—';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
            <p className="text-muted-foreground">Manage your client database.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline">
              <FileUp className="h-4 w-4 mr-2" />
              Import
            </Button>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button asChild>
              <Link to="/clients/new">
                <Plus className="h-4 w-4 mr-2" />
                Add Client
              </Link>
            </Button>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search clients..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="outline">Filter</Button>
        </div>
        
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No clients found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredClients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell>
                        <Link
                          to={`/clients/${client.id}`}
                          className="flex items-center gap-2 hover:underline"
                        >
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={client.photo_url || undefined} />
                            <AvatarFallback>{`${client.first_name[0]}${client.last_name[0]}`}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-nawitech-600">{getFullName(client)}</span>
                        </Link>
                      </TableCell>
                      <TableCell>{client.phone}</TableCell>
                      <TableCell>{client.email || "—"}</TableCell>
                      <TableCell>{getFullAddress(client)}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                            client.status === "active"
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {client.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/clients/${client.id}`}>View</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ClientsPage;
