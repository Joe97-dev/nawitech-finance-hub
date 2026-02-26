import { useState, useEffect } from "react";
import { ReportPage } from "./Base";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ExportButton } from "@/components/ui/export-button";
import { Card, CardContent } from "@/components/ui/card";
import { ReportFilters } from "@/components/reports/ReportFilters";
import { ReportStat, ReportStats } from "@/components/reports/ReportStats";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DormantClientData {
  id: string;
  client_name: string;
  phone_number: string;
  last_activity: string;
  days_inactive: number;
}

const inactivityRanges = [
  { value: "all", label: "All" },
  { value: "90-120", label: "90-120 days" },
  { value: "121-150", label: "121-150 days" },
  { value: "151-180", label: "151-180 days" },
  { value: "180+", label: "180+ days" }
];

const columns = [
  { key: "client_name", header: "Client Name" },
  { key: "phone_number", header: "Phone Number" },
  { key: "last_activity", header: "Last Activity" },
  { key: "days_inactive", header: "Days Inactive" }
];

const DormantClientsReport = () => {
  const { toast } = useToast();
  const [selectedRange, setSelectedRange] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dormantData, setDormantData] = useState<DormantClientData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDormantClients = async () => {
      try {
        setLoading(true);
        
        // Get clients who haven't had recent loan activity
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        
        const { data: clientsData, error: clientsError } = await supabase
          .from('clients')
          .select('id, first_name, last_name, phone, created_at');
          
        if (clientsError) throw clientsError;

        // Get recent loan activity for each client
        const { data: recentLoans, error: loansError } = await supabase
          .from('loans')
          .select('client, date')
          .gte('date', `${threeMonthsAgo.getFullYear()}-${String(threeMonthsAgo.getMonth() + 1).padStart(2, '0')}-${String(threeMonthsAgo.getDate()).padStart(2, '0')}`);
          
        if (loansError) throw loansError;

        // Create a set of clients with recent activity
        const activeClients = new Set(recentLoans?.map(loan => loan.client) || []);
        
        // Filter clients without recent activity
        const dormantClients: DormantClientData[] = (clientsData || [])
          .filter(client => {
            const fullName = `${client.first_name} ${client.last_name}`;
            return !activeClients.has(fullName);
          })
          .map(client => {
            const lastActivity = client.created_at;
            const daysInactive = Math.floor(
              (new Date().getTime() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24)
            );
            
            return {
              id: client.id,
              client_name: `${client.first_name} ${client.last_name}`,
              phone_number: client.phone || 'N/A',
              last_activity: lastActivity,
              days_inactive: daysInactive
            };
          })
          .filter(client => client.days_inactive >= 90); // Only show clients inactive for 90+ days

        setDormantData(dormantClients);
      } catch (error: any) {
        console.error("Error fetching dormant clients data:", error);
        toast({
          variant: "destructive",
          title: "Data fetch error",
          description: "Failed to load dormant clients data."
        });
        setDormantData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDormantClients();
  }, [toast]);

  // Filter data based on selected range and search query
  const filteredData = dormantData.filter(client => {
    const matchesRange = selectedRange === "all" || (() => {
      switch (selectedRange) {
        case "90-120": return client.days_inactive >= 90 && client.days_inactive <= 120;
        case "121-150": return client.days_inactive >= 121 && client.days_inactive <= 150;
        case "151-180": return client.days_inactive >= 151 && client.days_inactive <= 180;
        case "180+": return client.days_inactive > 180;
        default: return true;
      }
    })();
    
    const matchesSearch = searchQuery === "" || 
                         client.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         client.phone_number.includes(searchQuery);
    
    return matchesRange && matchesSearch;
  });

  // Calculate statistics
  const avgDaysInactive = filteredData.length > 0 
    ? Math.round(filteredData.reduce((sum, client) => sum + client.days_inactive, 0) / filteredData.length)
    : 0;

  const hasActiveFilters = selectedRange !== "all" || searchQuery !== "";

  const handleReset = () => {
    setSelectedRange("all");
    setSearchQuery("");
  };

  const filters = (
    <ReportFilters 
      title="Dormant Clients Filters" 
      hasActiveFilters={hasActiveFilters}
      onReset={handleReset}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Inactivity Range
          </label>
          <Select value={selectedRange} onValueChange={setSelectedRange}>
            <SelectTrigger className="border-dashed">
              <SelectValue placeholder="Select Range" />
            </SelectTrigger>
            <SelectContent>
              {inactivityRanges.map((range) => (
                <SelectItem key={range.value} value={range.value}>
                  {range.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
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
      </div>
      
      <div className="bg-muted/50 p-3 rounded-md flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div className="text-sm mb-2 sm:mb-0">
          <span className="font-medium">{filteredData.length}</span> dormant clients
        </div>
        <div className="text-sm font-medium">
          Average days inactive: <span className="text-primary">{avgDaysInactive} days</span>
        </div>
      </div>
    </ReportFilters>
  );

  return (
    <ReportPage
      title="Dormant Clients Report"
      description="Clients who haven't been active for an extended period"
      actions={
        <ExportButton 
          data={filteredData.map(client => ({
            client_name: client.client_name,
            phone_number: client.phone_number,
            last_activity: new Date(client.last_activity).toLocaleDateString(),
            days_inactive: client.days_inactive
          }))} 
          filename={`dormant-clients-report-${new Date().toISOString().slice(0, 10)}`} 
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
          <ReportStats>
            <ReportStat
              label="Total Dormant Clients"
              value={filteredData.length.toString()}
              subValue="90+ days inactive"
              trend="down"
              trendValue="12%"
            />
            <ReportStat
              label="Average Days Inactive"
              value={`${avgDaysInactive} days`}
              subValue="Across all dormant clients"
              trend="up"
              trendValue="8%"
            />
            <ReportStat
              label="Longest Inactive"
              value={filteredData.length > 0 ? `${Math.max(...filteredData.map(c => c.days_inactive))} days` : "0 days"}
              subValue="Most inactive client"
              trend="up"
              trendValue="5%"
            />
            <ReportStat
              label="Recently Dormant"
              value={filteredData.filter(c => c.days_inactive <= 120).length.toString()}
              subValue="90-120 days inactive"
              trend="down"
              trendValue="3%"
            />
          </ReportStats>

          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-medium mb-4">Dormant Clients</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client Name</TableHead>
                    <TableHead>Phone Number</TableHead>
                    <TableHead>Last Activity</TableHead>
                    <TableHead>Days Inactive</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                        No dormant clients found for the selected criteria
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredData.map((client) => (
                      <TableRow key={client.id}>
                        <TableCell className="font-medium">{client.client_name}</TableCell>
                        <TableCell>{client.phone_number}</TableCell>
                        <TableCell>{new Date(client.last_activity).toLocaleDateString()}</TableCell>
                        <TableCell>{client.days_inactive} days</TableCell>
                        <TableCell>
                          <Badge 
                            variant={client.days_inactive > 180 ? "destructive" : "outline"}
                          >
                            {client.days_inactive > 180 ? "Critical" : "Dormant"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </ReportPage>
  );
};

export default DormantClientsReport;