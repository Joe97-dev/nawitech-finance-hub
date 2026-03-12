import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getOrganizationId } from "@/lib/get-organization-id";
import { Loader2, Plus, Trash2 } from "lucide-react";

interface Referee {
  id?: string;
  name: string;
  phone: string;
  relationship: string;
}

interface EditClientRefereesDialogProps {
  clientId: string;
  clientName: string;
  currentReferees: Referee[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefereesUpdated: () => void;
}

export function EditClientRefereesDialog({
  clientId, clientName, currentReferees, open, onOpenChange, onRefereesUpdated
}: EditClientRefereesDialogProps) {
  const [loading, setLoading] = useState(false);
  const [referees, setReferees] = useState<Referee[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setReferees(currentReferees.length > 0
        ? currentReferees.map(r => ({ ...r }))
        : [{ name: "", phone: "", relationship: "" }]
      );
    }
  }, [open, currentReferees]);

  const addReferee = () => {
    if (referees.length >= 4) {
      toast({ variant: "destructive", title: "Maximum reached", description: "You can add up to 4 referees." });
      return;
    }
    setReferees(prev => [...prev, { name: "", phone: "", relationship: "" }]);
  };

  const removeReferee = (index: number) => {
    setReferees(prev => prev.filter((_, i) => i !== index));
  };

  const updateReferee = (index: number, field: keyof Referee, value: string) => {
    setReferees(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r));
  };

  const handleSubmit = async () => {
    const validReferees = referees.filter(r => r.name && r.phone && r.relationship);

    setLoading(true);
    try {
      const organizationId = await getOrganizationId();

      // Delete all existing referees for this client
      const { error: deleteError } = await supabase
        .from("client_referees")
        .delete()
        .eq("client_id", clientId);
      if (deleteError) throw deleteError;

      // Insert new referees
      if (validReferees.length > 0) {
        const { error: insertError } = await supabase
          .from("client_referees")
          .insert(validReferees.map(r => ({
            client_id: clientId,
            name: r.name,
            phone: r.phone,
            relationship: r.relationship,
            organization_id: organizationId,
          })));
        if (insertError) throw insertError;
      }

      toast({ title: "Success", description: "Referees updated successfully." });
      onRefereesUpdated();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error updating referees:", error);
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to update referees." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Referees — {clientName}</DialogTitle>
          <DialogDescription>Manage client referees (up to 4). All fields required per referee.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {referees.map((referee, index) => (
            <div key={index} className="border rounded-md p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="font-semibold">Referee {index + 1}</Label>
                <Button type="button" size="sm" variant="ghost" onClick={() => removeReferee(index)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Name</Label>
                  <Input value={referee.name} onChange={(e) => updateReferee(index, "name", e.target.value)} placeholder="Full name" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Phone</Label>
                  <Input value={referee.phone} onChange={(e) => updateReferee(index, "phone", e.target.value)} placeholder="Phone number" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Relationship</Label>
                  <Input value={referee.relationship} onChange={(e) => updateReferee(index, "relationship", e.target.value)} placeholder="e.g. Friend, Colleague" />
                </div>
              </div>
            </div>
          ))}

          {referees.length < 4 && (
            <Button type="button" variant="outline" onClick={addReferee} className="w-full">
              <Plus className="h-4 w-4 mr-2" /> Add Referee
            </Button>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Referees
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
