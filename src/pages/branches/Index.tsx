
import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";

// Dummy data for branches
const branchData = [
  {
    id: "head-office",
    name: "HEAD OFFICE",
    location: "Nairobi CBD",
    staffCount: 15,
    activeLoans: 450,
    totalPortfolio: 12500000,
  },
  {
    id: "westlands",
    name: "Westlands Branch",
    location: "Westlands, Nairobi",
    staffCount: 8,
    activeLoans: 230,
    totalPortfolio: 7800000,
  },
  {
    id: "mombasa",
    name: "Mombasa Branch",
    location: "Mombasa Town",
    staffCount: 6,
    activeLoans: 180,
    totalPortfolio: 5200000,
  },
  {
    id: "kisumu",
    name: "Kisumu Branch",
    location: "Kisumu CBD",
    staffCount: 5,
    activeLoans: 120,
    totalPortfolio: 4100000,
  },
  {
    id: "nakuru",
    name: "Nakuru Branch",
    location: "Nakuru Town",
    staffCount: 4,
    activeLoans: 90,
    totalPortfolio: 2800000,
  },
];

const BranchesIndex = () => {
  const [branches, setBranches] = useState(branchData);
  const [open, setOpen] = useState(false);
  const [newBranch, setNewBranch] = useState({
    name: "",
    location: "",
  });
  const { toast } = useToast();

  const handleAddBranch = () => {
    if (!newBranch.name || !newBranch.location) {
      toast({
        title: "Missing Information",
        description: "Please provide both name and location for the branch.",
        variant: "destructive",
      });
      return;
    }

    const branch = {
      id: newBranch.name.toLowerCase().replace(/\s+/g, "-"),
      name: newBranch.name,
      location: newBranch.location,
      staffCount: 0,
      activeLoans: 0,
      totalPortfolio: 0,
    };

    setBranches([...branches, branch]);
    setNewBranch({ name: "", location: "" });
    setOpen(false);

    toast({
      title: "Branch Added",
      description: `${branch.name} has been successfully added.`,
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Branch Management</h1>
            <p className="text-muted-foreground">Manage your microfinance branches</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <PlusCircle className="h-4 w-4 mr-2" /> Add Branch
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Branch</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Branch Name</Label>
                  <Input
                    id="name"
                    value={newBranch.name}
                    onChange={(e) => setNewBranch({ ...newBranch, name: e.target.value })}
                    placeholder="e.g. Westlands Branch"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={newBranch.location}
                    onChange={(e) => setNewBranch({ ...newBranch, location: e.target.value })}
                    placeholder="e.g. Westlands, Nairobi"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleAddBranch}>Add Branch</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Branches</CardTitle>
            <CardDescription>List of all microfinance branches</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Branch Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Staff</TableHead>
                  <TableHead>Active Loans</TableHead>
                  <TableHead>Portfolio (KES)</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {branches.map((branch) => (
                  <TableRow key={branch.id}>
                    <TableCell className="font-medium">{branch.name}</TableCell>
                    <TableCell>{branch.location}</TableCell>
                    <TableCell>{branch.staffCount}</TableCell>
                    <TableCell>{branch.activeLoans}</TableCell>
                    <TableCell>{branch.totalPortfolio.toLocaleString()}</TableCell>
                    <TableCell>
                      <Link to={`/branches/${branch.id}`}>
                        <Button variant="outline" size="sm">
                          View Details
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default BranchesIndex;
