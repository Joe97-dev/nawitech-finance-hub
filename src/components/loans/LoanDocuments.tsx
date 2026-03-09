
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useRole } from "@/context/RoleContext";
import { FileText, PlusCircle, Download, Eye, Trash2, Loader2 } from "lucide-react";

interface LoanDocument {
  id: string;
  name: string;
  document_type: string;
  file_path: string;
  uploaded_by: string;
  created_at: string;
}

interface LoanDocumentsProps {
  loanId: string;
}

export function LoanDocuments({ loanId }: LoanDocumentsProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { isAdmin, isLoanOfficer } = useRole();
  const [documents, setDocuments] = useState<LoanDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentName, setDocumentName] = useState("");
  const [documentType, setDocumentType] = useState("application");
  
  // Document type options
  const documentTypes = [
    { value: "application", label: "Loan Application" },
    { value: "id", label: "ID Document" },
    { value: "income", label: "Proof of Income" },
    { value: "collateral", label: "Collateral Document" },
    { value: "approval", label: "Approval Document" },
    { value: "contract", label: "Loan Contract" },
    { value: "other", label: "Other" }
  ];

  const canUpload = isAdmin || isLoanOfficer;

  useEffect(() => {
    fetchDocuments();
  }, [loanId]);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('loan_documents')
        .select('*')
        .eq('loan_id', loanId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setDocuments(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to fetch documents: ${error.message}`
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!documentName) {
        setDocumentName(file.name.split('.')[0]);
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !documentName || !user) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please provide all required fields"
      });
      return;
    }

    setUploading(true);
    try {
      // 1. Upload file to storage
      const fileExt = selectedFile.name.split('.').pop();
      const filePath = `${loanId}/${Date.now()}-${documentName}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('loan_documents')
        .upload(filePath, selectedFile);
        
      if (uploadError) throw uploadError;

      // 2. Add document record to database
      const { error: dbError } = await supabase
        .from('loan_documents')
        .insert({
          loan_id: loanId,
          name: documentName,
          document_type: documentType,
          file_path: filePath,
          uploaded_by: user.id
        });
        
      if (dbError) throw dbError;
      
      // 3. Reset form and close dialog
      setSelectedFile(null);
      setDocumentName("");
      setDocumentType("application");
      setIsDialogOpen(false);
      
      // 4. Refresh documents list
      fetchDocuments();
      
      toast({
        title: "Success",
        description: "Document uploaded successfully"
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Upload Error",
        description: error.message
      });
    } finally {
      setUploading(false);
    }
  };

  // Fixed function: renamed parameter from 'document' to 'docItem' to avoid name collision with global document
  const downloadDocument = async (docItem: LoanDocument) => {
    try {
      const { data, error } = await supabase.storage
        .from('loan_documents')
        .download(docItem.file_path);
        
      if (error) throw error;
      
      // Create download link - now correctly references the global document object
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = docItem.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Download Error",
        description: error.message
      });
    }
  };

  const deleteDocument = async (documentId: string, filePath: string) => {
    if (!isAdmin) {
      toast({
        variant: "destructive",
        title: "Permission Denied",
        description: "You don't have permission to delete documents"
      });
      return;
    }

    try {
      // 1. Delete file from storage
      const { error: storageError } = await supabase.storage
        .from('loan_documents')
        .remove([filePath]);
      
      if (storageError) throw storageError;
      
      // 2. Delete record from database
      const { error: dbError } = await supabase
        .from('loan_documents')
        .delete()
        .eq('id', documentId);
        
      if (dbError) throw dbError;
      
      // 3. Update local state
      setDocuments(documents.filter(doc => doc.id !== documentId));
      
      toast({
        title: "Success",
        description: "Document deleted successfully"
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Deletion Error",
        description: error.message
      });
    }
  };

  const getDocumentTypeName = (type: string) => {
    const docType = documentTypes.find(dt => dt.value === type);
    return docType ? docType.label : type;
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Loan Documents</h3>
        
        {canUpload && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="flex items-center gap-1">
                <PlusCircle className="h-4 w-4" />
                <span>Upload Document</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Loan Document</DialogTitle>
                <DialogDescription>
                  Add a new document to this loan record.
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="documentName">Document Name</Label>
                  <Input
                    id="documentName"
                    value={documentName}
                    onChange={(e) => setDocumentName(e.target.value)}
                    placeholder="Enter document name"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="documentType">Document Type</Label>
                  <Select
                    value={documentType}
                    onValueChange={setDocumentType}
                  >
                    <SelectTrigger id="documentType">
                      <SelectValue placeholder="Select document type" />
                    </SelectTrigger>
                    <SelectContent>
                      {documentTypes.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="file">Document File</Label>
                  <div className="border border-dashed rounded-md p-6 text-center">
                    <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-1">
                      {selectedFile ? selectedFile.name : "Click to select a file"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Supported formats: PDF, DOCX, JPG, PNG (Max 10MB)
                    </p>
                    <Input
                      id="file"
                      type="file"
                      className="sr-only"
                      onChange={handleFileChange}
                    />
                    <Label htmlFor="file" className="inline-block mt-4">
                      <Button type="button" variant="outline" size="sm">
                        Browse Files
                      </Button>
                    </Label>
                  </div>
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleUpload} 
                  disabled={uploading || !selectedFile || !documentName}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : "Upload Document"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
      
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Upload Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-4">
                  <div className="flex justify-center">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    <span>Loading documents...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : documents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                  No documents found
                </TableCell>
              </TableRow>
            ) : (
              documents.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell>
                    <div className="flex items-center">
                      <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
                      {doc.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    {getDocumentTypeName(doc.document_type)}
                  </TableCell>
                  <TableCell>
                    {new Date(doc.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => downloadDocument(doc)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                      
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteDocument(doc.id, doc.file_path)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
