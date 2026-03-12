import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getOrganizationId } from "@/lib/get-organization-id";
import { Loader2, Upload, Trash2, FileText } from "lucide-react";

interface ClientDocument {
  id: string;
  document_type: string;
  document_name: string;
  file_path: string;
  created_at: string;
}

interface EditClientDocumentsDialogProps {
  clientId: string;
  clientName: string;
  currentDocuments: ClientDocument[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDocumentsUpdated: () => void;
}

interface NewDocument {
  file: File;
  documentType: string;
}

export function EditClientDocumentsDialog({
  clientId, clientName, currentDocuments, open, onOpenChange, onDocumentsUpdated
}: EditClientDocumentsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [newDocuments, setNewDocuments] = useState<NewDocument[]>([]);
  const [selectedType, setSelectedType] = useState("document");
  const { toast } = useToast();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const docs = files.map(file => ({ file, documentType: selectedType }));
    setNewDocuments(prev => [...prev, ...docs]);
    e.target.value = "";
  };

  const removeNewDoc = (index: number) => {
    setNewDocuments(prev => prev.filter((_, i) => i !== index));
  };

  const handleDeleteExisting = async (docId: string, filePath: string) => {
    setDeletingId(docId);
    try {
      // Delete from storage
      await supabase.storage.from("client-documents").remove([filePath]);
      // Delete record
      const { error } = await supabase.from("client_documents").delete().eq("id", docId);
      if (error) throw error;
      toast({ title: "Deleted", description: "Document removed successfully." });
      onDocumentsUpdated();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to delete document." });
    } finally {
      setDeletingId(null);
    }
  };

  const handleUpload = async () => {
    if (newDocuments.length === 0) {
      onOpenChange(false);
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const organizationId = await getOrganizationId();

      for (const doc of newDocuments) {
        const filePath = `documents/${clientId}/${Date.now()}_${doc.file.name}`;
        const { error: uploadError } = await supabase.storage.from("client-documents").upload(filePath, doc.file);
        if (uploadError) throw uploadError;

        const { error: insertError } = await supabase.from("client_documents").insert({
          client_id: clientId,
          document_name: doc.file.name,
          file_path: filePath,
          document_type: doc.documentType,
          uploaded_by: user.id,
          organization_id: organizationId,
        });
        if (insertError) throw insertError;
      }

      toast({ title: "Success", description: `${newDocuments.length} document(s) uploaded.` });
      setNewDocuments([]);
      onDocumentsUpdated();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error uploading documents:", error);
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to upload documents." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Documents — {clientName}</DialogTitle>
          <DialogDescription>Upload new documents or remove existing ones.</DialogDescription>
        </DialogHeader>

        {/* Existing documents */}
        {currentDocuments.length > 0 && (
          <div className="space-y-2">
            <Label className="font-semibold">Existing Documents</Label>
            {currentDocuments.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between p-2 border rounded">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{doc.document_name}</p>
                    <p className="text-xs text-muted-foreground">{doc.document_type}</p>
                  </div>
                </div>
                <Button
                  size="sm" variant="ghost"
                  disabled={deletingId === doc.id}
                  onClick={() => handleDeleteExisting(doc.id, doc.file_path)}
                >
                  {deletingId === doc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Upload new documents */}
        <div className="space-y-3 border-t pt-4">
          <Label className="font-semibold">Add New Documents</Label>
          <div className="flex gap-2">
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="document">General Document</SelectItem>
                <SelectItem value="id_photo">ID Photo</SelectItem>
                <SelectItem value="business_photo">Business Photo</SelectItem>
                <SelectItem value="contract">Contract</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex-1">
              <input type="file" multiple className="sr-only" id="doc-upload" onChange={handleFileSelect} />
              <Label htmlFor="doc-upload" className="cursor-pointer">
                <div className="flex items-center justify-center gap-2 border border-dashed rounded-md py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <Upload className="h-4 w-4" /> Select files
                </div>
              </Label>
            </div>
          </div>

          {newDocuments.length > 0 && (
            <div className="space-y-1">
              {newDocuments.map((doc, i) => (
                <div key={i} className="flex items-center justify-between p-2 border rounded bg-muted/50">
                  <div>
                    <p className="text-sm">{doc.file.name}</p>
                    <p className="text-xs text-muted-foreground">{doc.documentType}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => removeNewDoc(i)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
          <Button onClick={handleUpload} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Upload & Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
