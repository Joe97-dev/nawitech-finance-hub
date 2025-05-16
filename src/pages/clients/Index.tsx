
import { useState } from "react";
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

// Sample client data
const clients = [
  { id: 1, name: "Jane Cooper", phone: "(254) 555-0111", email: "jane@example.com", address: "Nairobi, Kenya", status: "active" },
  { id: 2, name: "Wade Warren", phone: "(254) 555-0222", email: "wade@example.com", address: "Nakuru, Kenya", status: "active" },
  { id: 3, name: "Esther Howard", phone: "(254) 555-0333", email: "esther@example.com", address: "Mombasa, Kenya", status: "inactive" },
  { id: 4, name: "Cameron Williamson", phone: "(254) 555-0444", email: "cameron@example.com", address: "Kisumu, Kenya", status: "active" },
  { id: 5, name: "Brooklyn Simmons", phone: "(254) 555-0555", email: "brooklyn@example.com", address: "Eldoret, Kenya", status: "inactive" },
  { id: 6, name: "Leslie Alexander", phone: "(254) 555-0666", email: "leslie@example.com", address: "Machakos, Kenya", status: "active" },
  { id: 7, name: "Jenny Wilson", phone: "(254) 555-0777", email: "jenny@example.com", address: "Thika, Kenya", status: "active" },
  { id: 8, name: "Guy Hawkins", phone: "(254) 555-0888", email: "guy@example.com", address: "Kitale, Kenya", status: "active" },
];

const ClientsPage = () => {
  const [searchQuery, setSearchQuery] = useState("");
  
  const filteredClients = clients.filter(client => 
    client.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    client.phone.includes(searchQuery) ||
    client.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
                        className="font-medium text-nawitech-600 hover:underline"
                      >
                        {client.name}
                      </Link>
                    </TableCell>
                    <TableCell>{client.phone}</TableCell>
                    <TableCell>{client.email}</TableCell>
                    <TableCell>{client.address}</TableCell>
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
      </div>
    </DashboardLayout>
  );
};

export default ClientsPage;
