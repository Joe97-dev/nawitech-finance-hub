import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PiggyBank, Plus } from "lucide-react";

export const GlobalDrawDownManager: React.FC = () => {
  const [globalBalance, setGlobalBalance] = useState(0);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  useEffect(() => {
    fetchGlobalBalance();
  }, []);

  const fetchGlobalBalance = async () => {
    try {
      const { data, error } = await supabase
        .from('global_draw_down_account')
        .select('total_balance')
        .single();

      if (error) throw error;

      setGlobalBalance(data?.total_balance || 0);
    } catch (error: any) {
      console.error('Error fetching global balance:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch global draw down balance"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddFunds = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amount) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter an amount"
      });
      return;
    }

    const depositAmount = parseFloat(amount);
    if (isNaN(depositAmount) || depositAmount <= 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a valid amount"
      });
      return;
    }

    setIsProcessing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Update global balance
      const newBalance = globalBalance + depositAmount;
      
      const { error: updateError } = await supabase
        .from('global_draw_down_account')
        .update({ total_balance: newBalance });

      if (updateError) throw updateError;

      // Reset form
      setAmount("");
      setNotes("");
      
      // Update local state
      setGlobalBalance(newBalance);

      toast({
        title: "Success",
        description: `Added ${formatCurrency(depositAmount)} to global draw down account`
      });

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to add funds: ${error.message}`
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PiggyBank className="h-5 w-5 text-green-600" />
            Global Draw Down Account
          </CardTitle>
          <CardDescription>
            Central account for all client draw down balances
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-green-600">
            {formatCurrency(globalBalance)}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Total available for loan payments
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add Funds
          </CardTitle>
          <CardDescription>
            Add funds to the global draw down account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddFunds} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="add-amount">Amount *</Label>
                <Input
                  id="add-amount"
                  type="number"
                  step="0.01"
                  placeholder="Enter amount to add"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="add-notes">Notes (Optional)</Label>
                <Textarea
                  id="add-notes"
                  placeholder="Transaction notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
            
            <Button 
              type="submit" 
              disabled={isProcessing}
              className="w-full md:w-auto"
            >
              {isProcessing ? "Processing..." : "Add Funds"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};