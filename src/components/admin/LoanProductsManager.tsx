import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { PlusCircle, Pencil, Trash2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface LoanProduct {
  id: string;
  name: string;
  interest_rate: number;
  term_min: number;
  term_max: number;
  term_unit: string;
  amount_min: number;
  amount_max: number;
  description: string | null;
  created_at: string;
  status: string;
  created_by: string | null;
  updated_at: string;
}

export function LoanProductsManager() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<LoanProduct | null>(null);
  const [newProduct, setNewProduct] = useState({
    name: "",
    interest_rate: "12",
    term_min: "1",
    term_max: "36",
    term_unit: "months",
    amount_min: "1000",
    amount_max: "100000",
    description: "",
    status: "active"
  });

  useEffect(() => {
    fetchLoanProducts();
  }, []);

  const fetchLoanProducts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('loan_products')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setProducts(data as LoanProduct[] || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        description: `Failed to fetch loan products: ${error.message}`
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setNewProduct({
      ...newProduct,
      [field]: value
    });
  };

  const handleSaveProduct = async () => {
    if (!user) {
      toast({
        variant: "destructive",
        description: "You must be logged in to manage loan products."
      });
      return;
    }
    
    if (!newProduct.name) {
      toast({
        variant: "destructive",
        description: "Please enter a product name."
      });
      return;
    }
    
    try {
      const productData = {
        name: newProduct.name,
        interest_rate: parseFloat(newProduct.interest_rate),
        term_min: parseInt(newProduct.term_min),
        term_max: parseInt(newProduct.term_max),
        term_unit: newProduct.term_unit,
        amount_min: parseFloat(newProduct.amount_min),
        amount_max: parseFloat(newProduct.amount_max),
        description: newProduct.description || null,
        status: newProduct.status,
        created_by: user.id
      };
      
      let operation: any;
      
      if (editingProduct) {
        // Update existing product
        operation = await supabase
          .from('loan_products')
          .update(productData)
          .eq('id', editingProduct.id)
          .select();
      } else {
        // Insert new product
        operation = await supabase
          .from('loan_products')
          .insert(productData)
          .select();
      }
        
      const { error } = operation;
        
      if (error) throw error;
      
      // Reset form and close dialog
      setNewProduct({
        name: "",
        interest_rate: "12",
        term_min: "1",
        term_max: "36",
        term_unit: "months",
        amount_min: "1000",
        amount_max: "100000",
        description: "",
        status: "active"
      });
      
      setIsDialogOpen(false);
      setEditingProduct(null);
      
      // Refresh loan products list
      fetchLoanProducts();
      
      toast({
        description: editingProduct 
          ? "Loan product updated successfully." 
          : "Loan product created successfully."
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        description: error.message
      });
    }
  };

  const handleEditProduct = (product: LoanProduct) => {
    setEditingProduct(product);
    setNewProduct({
      name: product.name,
      interest_rate: product.interest_rate.toString(),
      term_min: product.term_min.toString(),
      term_max: product.term_max.toString(),
      term_unit: product.term_unit,
      amount_min: product.amount_min.toString(),
      amount_max: product.amount_max.toString(),
      description: product.description || "",
      status: product.status
    });
    setIsDialogOpen(true);
  };

  const handleDeleteProduct = async (productId: string) => {
    if (confirm("Are you sure you want to delete this loan product?")) {
      try {
        const { error } = await supabase
          .from('loan_products')
          .delete()
          .eq('id', productId);
          
        if (error) throw error;
        
        // Refresh loan products list
        fetchLoanProducts();
        
        toast({
          description: "Loan product deleted successfully."
        });
      } catch (error: any) {
        toast({
          variant: "destructive",
          description: error.message
        });
      }
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Loan Products</CardTitle>
          <CardDescription>
            Manage loan products offered to clients
          </CardDescription>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-1">
              <PlusCircle className="h-4 w-4" />
              <span>Add Product</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[625px]">
            <DialogHeader>
              <DialogTitle>
                {editingProduct ? "Edit Loan Product" : "Add New Loan Product"}
              </DialogTitle>
              <DialogDescription>
                {editingProduct 
                  ? "Update the details of this loan product." 
                  : "Create a new loan product to offer to clients."}
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Product Name</Label>
                  <Input
                    id="name"
                    value={newProduct.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    placeholder="e.g. Business Loan"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="interest_rate">Interest Rate (%)</Label>
                  <Input
                    id="interest_rate"
                    type="number"
                    min="0"
                    step="0.01"
                    value={newProduct.interest_rate}
                    onChange={(e) => handleInputChange("interest_rate", e.target.value)}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="term_min">Min Term</Label>
                  <Input
                    id="term_min"
                    type="number"
                    min="1"
                    value={newProduct.term_min}
                    onChange={(e) => handleInputChange("term_min", e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="term_max">Max Term</Label>
                  <Input
                    id="term_max"
                    type="number"
                    min="1"
                    value={newProduct.term_max}
                    onChange={(e) => handleInputChange("term_max", e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="term_unit">Term Unit</Label>
                  <Select 
                    value={newProduct.term_unit}
                    onValueChange={(value) => handleInputChange("term_unit", value)}
                  >
                    <SelectTrigger id="term_unit">
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="days">Days</SelectItem>
                      <SelectItem value="weeks">Weeks</SelectItem>
                      <SelectItem value="months">Months</SelectItem>
                      <SelectItem value="years">Years</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount_min">Min Amount</Label>
                  <Input
                    id="amount_min"
                    type="number"
                    min="0"
                    value={newProduct.amount_min}
                    onChange={(e) => handleInputChange("amount_min", e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="amount_max">Max Amount</Label>
                  <Input
                    id="amount_max"
                    type="number"
                    min="0"
                    value={newProduct.amount_max}
                    onChange={(e) => handleInputChange("amount_max", e.target.value)}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newProduct.description}
                  onChange={(e) => handleInputChange("description", e.target.value)}
                  placeholder="Provide details about this loan product"
                  rows={3}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select 
                  value={newProduct.status}
                  onValueChange={(value) => handleInputChange("status", value)}
                >
                  <SelectTrigger id="status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setIsDialogOpen(false);
                setEditingProduct(null);
                setNewProduct({
                  name: "",
                  interest_rate: "12",
                  term_min: "1",
                  term_max: "36",
                  term_unit: "months",
                  amount_min: "1000",
                  amount_max: "100000",
                  description: "",
                  status: "active"
                });
              }}>
                Cancel
              </Button>
              <Button onClick={handleSaveProduct}>
                {editingProduct ? "Update Product" : "Create Product"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Interest Rate</TableHead>
                  <TableHead>Term</TableHead>
                  <TableHead>Amount Range</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                      No loan products available
                    </TableCell>
                  </TableRow>
                ) : (
                  products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>{product.interest_rate}%</TableCell>
                      <TableCell>
                        {product.term_min === product.term_max 
                          ? `${product.term_min} ${product.term_unit}` 
                          : `${product.term_min}-${product.term_max} ${product.term_unit}`}
                      </TableCell>
                      <TableCell>
                        {new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: 'KES'
                        }).format(product.amount_min)} - {new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: 'KES'
                        }).format(product.amount_max)}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          product.status === 'active' 
                            ? 'bg-green-50 text-green-700' 
                            : product.status === 'inactive' 
                              ? 'bg-red-50 text-red-700'
                              : 'bg-yellow-50 text-yellow-700'
                        }`}>
                          {product.status.charAt(0).toUpperCase() + product.status.slice(1)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleEditProduct(product)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleDeleteProduct(product.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
