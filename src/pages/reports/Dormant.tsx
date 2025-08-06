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
  { key: "clientName", header: "Client Name" },
  { key: "phoneNumber", header: "Phone Number" },
  { key: "lastActivity", header: "Last Activity" },
  { key: "daysInactive", header: "Days Inactive" },
  { key: "branch", header: "Branch" }
];

const DormantClientsReport = () => {
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [selectedRange, setSelectedRange] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Filter data based on selected branch, inactivity range, and search query
  const filteredClients = dormantClientsData.filter(client => {
    const matchesBranch = selectedBranch === "all" || client.branch === selectedBranch;
    
    // Check if client falls within selected inactivity range
    let matchesRange = true;
    if (selectedRange === "90-120") {
      matchesRange = client.daysInactive >= 90 && client.daysInactive <= 120;
    } else if (selectedRange === "121-150") {
      matchesRange = client.daysInactive >= 121 && client.daysInactive <= 150;
    } else if (selectedRange === "151-180") {
      matchesRange = client.daysInactive >= 151 && client.daysInactive <= 180;
    } else if (selectedRange === "180+") {
      matchesRange = client.daysInactive > 180;
    }
    
    // Check if client matches search query
    const matchesSearch = searchQuery === "" || 
                         client.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         client.phoneNumber.includes(searchQuery);
    
    return matchesBranch && matchesRange && matchesSearch;
  });
  
  // Calculate statistics
  const totalClients = filteredClients.length;
  const inactivityGroups = {
    "90-120": filteredClients.filter(c => c.daysInactive >= 90 && c.daysInactive <= 120).length,
    "121-150": filteredClients.filter(c => c.daysInactive >= 121 && c.daysInactive <= 150).length,
    "151-180": filteredClients.filter(c => c.daysInactive >= 151 && c.daysInactive <= 180).length,
    "180+": filteredClients.filter(c => c.daysInactive > 180).length
  };

  const filters = (
    <ReportFilters title="Dormant Client Filters">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Branch</label>
          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
            <SelectTrigger className="w-full">
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
        </div>
        
        <div className="space-y-2">
          <label className="text-sm font-medium">Inactivity Period</label>
          <Select value={selectedRange} onValueChange={setSelectedRange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Inactivity Period" />
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
        
        <div className="space-y-2">
          <label className="text-sm font-medium">Search</label>
          <Input 
            placeholder="Search by client name or phone" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>
      
      <div className="mt-4 bg-muted/50 p-3 rounded-md">
        <div className="text-sm">
          <span className="font-medium">{totalClients}</span> dormant clients found
        </div>
      </div>
    </ReportFilters>
  );
  
  return (
    <ReportPage
      title="Dormant Clients Report"
      description="Clients with no active loans / dormant accounts"
      actions={
        <ExportButton 
          data={filteredClients.map(client => ({
            ...client,
            branch: branches.find(b => b.value === client.branch)?.label || client.branch
          }))} 
          filename={`dormant-clients-${selectedBranch}-${format(new Date(), 'yyyy-MM-dd')}`} 
          columns={columns} 
        />
      }
      filters={filters}
    >
      <div className="space-y-6">
        <ReportStats>
          <ReportStat 
            label="90-120 Days" 
            value={inactivityGroups["90-120"]}
          />
          <ReportStat 
            label="121-150 Days" 
            value={inactivityGroups["121-150"]}
          />
          <ReportStat 
            label="151-180 Days" 
            value={inactivityGroups["151-180"]}
          />
          <ReportStat 
            label="180+ Days" 
            value={inactivityGroups["180+"]}
          />
        </ReportStats>

        <Card className="shadow-sm">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client Name</TableHead>
                  <TableHead>Phone Number</TableHead>
                  <TableHead>Last Activity</TableHead>
                  <TableHead>Days Inactive</TableHead>
                  <TableHead>Branch</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                      No dormant clients match your criteria
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredClients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">{client.clientName}</TableCell>
                      <TableCell>{client.phoneNumber}</TableCell>
                      <TableCell>{client.lastActivity}</TableCell>
                      <TableCell>{client.daysInactive}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {branches.find(b => b.value === client.branch)?.label || client.branch}
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
    </ReportPage>
  );
};

export default DormantClientsReport;
