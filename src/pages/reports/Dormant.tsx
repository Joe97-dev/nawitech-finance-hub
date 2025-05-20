
import { useState } from "react";
import { ReportPage } from "./Base";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ExportButton } from "@/components/ui/export-button";
import { Card, CardContent } from "@/components/ui/card";

// Dummy data for dormant clients
const dormantClientsData = [
  { id: 1, clientName: "Jane Akinyi", phoneNumber: "0767890123", lastActivity: "2024-12-15", daysInactive: 156, branch: "head-office" },
  { id: 2, clientName: "Samuel Maina", phoneNumber: "0778901234", lastActivity: "2025-01-20", daysInactive: 120, branch: "head-office" },
  { id: 3, clientName: "Grace Atieno", phoneNumber: "0789012345", lastActivity: "2025-02-05", daysInactive: 104, branch: "head-office" },
  { id: 4, clientName: "Daniel Mutua", phoneNumber: "0790123456", lastActivity: "2025-01-10", daysInactive: 130, branch: "head-office" },
  { id: 5, clientName: "Sarah Njeri", phoneNumber: "0701234567", lastActivity: "2024-11-30", daysInactive: 171, branch: "head-office" },
  { id: 6, clientName: "Dennis Mutiso", phoneNumber: "0745678902", lastActivity: "2024-12-25", daysInactive: 146, branch: "westlands" },
  { id: 7, clientName: "Elizabeth Njoki", phoneNumber: "0756789013", lastActivity: "2025-01-30", daysInactive: 110, branch: "westlands" },
  { id: 8, clientName: "Hassan Ali", phoneNumber: "0789012346", lastActivity: "2025-01-05", daysInactive: 135, branch: "mombasa" },
  { id: 9, clientName: "Isabella Mohammed", phoneNumber: "0790123457", lastActivity: "2024-12-10", daysInactive: 161, branch: "mombasa" },
  { id: 10, clientName: "James Mbugua", phoneNumber: "0701234568", lastActivity: "2025-02-15", daysInactive: 94, branch: "mombasa" },
  { id: 11, clientName: "Michael Oduor", phoneNumber: "0734567892", lastActivity: "2025-01-15", daysInactive: 125, branch: "kisumu" },
  { id: 12, clientName: "Nancy Adhiambo", phoneNumber: "0745678903", lastActivity: "2024-11-20", daysInactive: 181, branch: "kisumu" },
  { id: 13, clientName: "Quentin Korir", phoneNumber: "0778901236", lastActivity: "2025-02-10", daysInactive: 99, branch: "nakuru" },
  { id: 14, clientName: "Rose Chebet", phoneNumber: "0789012347", lastActivity: "2025-01-25", daysInactive: 115, branch: "nakuru" },
  { id: 15, clientName: "Titus Koech", phoneNumber: "0790123458", lastActivity: "2024-12-05", daysInactive: 166, branch: "head-office" },
  { id: 16, clientName: "Vivian Chepkorir", phoneNumber: "0701234569", lastActivity: "2025-02-20", daysInactive: 89, branch: "westlands" },
  { id: 17, clientName: "Walter Musyoka", phoneNumber: "0712345677", lastActivity: "2025-01-08", daysInactive: 132, branch: "mombasa" },
  { id: 18, clientName: "Zipporah Muthoni", phoneNumber: "0723456788", lastActivity: "2024-11-15", daysInactive: 186, branch: "kisumu" },
  { id: 19, clientName: "Aaron Kiprono", phoneNumber: "0734567893", lastActivity: "2025-02-25", daysInactive: 84, branch: "nakuru" },
  { id: 20, clientName: "Beatrice Wangari", phoneNumber: "0745678904", lastActivity: "2025-01-18", daysInactive: 122, branch: "head-office" },
];

const branches = [
  { value: "all", label: "All Branches" },
  { value: "head-office", label: "HEAD OFFICE" },
  { value: "westlands", label: "Westlands Branch" },
  { value: "mombasa", label: "Mombasa Branch" },
  { value: "kisumu", label: "Kisumu Branch" },
  { value: "nakuru", label: "Nakuru Branch" }
];

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
  
  return (
    <ReportPage
      title="Dormant Clients Report"
      description="Clients with no active loans / dormant accounts"
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
            
            <Select value={selectedRange} onValueChange={setSelectedRange}>
              <SelectTrigger className="w-full sm:w-40">
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
            
            <Input 
              placeholder="Search by client name or phone" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-auto flex-1"
            />
            
            <ExportButton 
              data={filteredClients.map(client => ({
                ...client,
                branch: branches.find(b => b.value === client.branch)?.label || client.branch
              }))} 
              filename={`dormant-clients-${selectedBranch}-${format(new Date(), 'yyyy-MM-dd')}`} 
              columns={columns} 
            />
          </div>
          
          <div className="flex items-center justify-between bg-muted/50 p-2 rounded-md">
            <div className="text-sm">
              <span className="font-medium">{totalClients}</span> dormant clients found
            </div>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">90-120 Days</div>
              <div className="text-2xl font-bold">{inactivityGroups["90-120"]}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">121-150 Days</div>
              <div className="text-2xl font-bold">{inactivityGroups["121-150"]}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">151-180 Days</div>
              <div className="text-2xl font-bold">{inactivityGroups["151-180"]}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">180+ Days</div>
              <div className="text-2xl font-bold">{inactivityGroups["180+"]}</div>
            </CardContent>
          </Card>
        </div>

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
                <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
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
      </div>
    </ReportPage>
  );
};

export default DormantClientsReport;
