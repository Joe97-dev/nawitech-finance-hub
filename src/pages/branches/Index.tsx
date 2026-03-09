
import { useState, useEffect } from "react";
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
import { supabase } from "@/integrations/supabase/client";

interface Branch {
  id: string;
  name: string;
  location: string;
  staff_count: number;
  active_loans: number;
  total_portfolio: number;
}

const BranchesIndex = () => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newBranch, setNewBranch] = useState({
    name: "",
    location: "",
  });
  const { toast } = useToast();

  // Fetch branches from Supabase
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('branches')
          .select('*');
        
        if (error) {
          throw error;
        }
        
        setBranches(data || []);
      } catch (error: any) {
        console.error("Error fetching branches:", error);
        toast({
          variant: "destructive",
          title: "Failed to load branches",
          description: error.message || "There was an error loading the branch list."
        });
      } finally {
        setLoading(false);
      }
    };

    fetchBranches();
  }, [toast]);

  const handleAddBranch = async () => {
    if (!newBranch.name || !newBranch.location) {
      toast({
        title: "Missing Information",
        description: "Please provide both name and location for the branch.",
        variant: "destructive",
      });
      return;
    }

    try {
      const branch = {
        name: newBranch.name,
        location: newBranch.location,
        staff_count: 0,
        active_loans: 0,
        total_portfolio: 0,
      };

      const { data, error } = await supabase
        .from('branches')
        .insert(branch)
        .select()
        .single();

      if (error) {
        throw error;
      }

      setBranches([...branches, data]);
      setNewBranch({ name: "", location: "" });
      setOpen(false);

      toast({
        title: "Branch Added",
        description: `${branch.name} has been successfully added.`,
      });
    } catch (error: any) {
      console.error("Error adding branch:", error);
      toast({
        variant: "destructive",
        title: "Failed to add branch",
        description: error.message || "There was an error adding the branch."
      });
    }
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
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
              </div>
            ) : (
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
                  {branches.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                        No branches found. Add your first branch to get started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    branches.map((branch) => (
                      <TableRow key={branch.id}>
                        <TableCell className="font-medium">{branch.name}</TableCell>
                        <TableCell>{branch.location}</TableCell>
                        <TableCell>{branch.staff_count}</TableCell>
                        <TableCell>{branch.active_loans}</TableCell>
                        <TableCell>{branch.total_portfolio.toLocaleString()}</TableCell>
                        <TableCell>
                          <Link to={`/branches/${branch.id}`}>
                            <Button variant="outline" size="sm">
                              View Details
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default BranchesIndex;
