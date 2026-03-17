import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getOrganizationId } from "@/lib/get-organization-id";
import { compressImageFile, sanitizeUploadFileName } from "@/lib/image-upload";
import { Loader2, Upload, Camera, X, Plus, Trash2, FileText } from "lucide-react";

interface Client {
  id: string;
  client_number?: string;
  first_name: string;
  last_name: string;
  phone: string;
  id_number: string;
  gender: string | null;
  date_of_birth: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  occupation: string | null;
  employment_status: string | null;
  monthly_income: number | null;
  status: string;
  loan_officer_id?: string | null;
  photo_url?: string | null;
  id_photo_front_url?: string | null;
  id_photo_back_url?: string | null;
  business_photo_url?: string | null;
  [key: string]: any;
}

interface LoanOfficer {
  id: string;
  username: string;
  first_name: string | null;
  last_name: string | null;
}

interface ClientReferee {
  id?: string;
  name: string;
  phone: string;
  relationship: string;
}

interface ClientDocument {
  id: string;
  document_type: string;
  document_name: string;
  file_path: string;
  created_at: string;
}

interface SignedUrls {
  id_photo_front?: string;
  id_photo_back?: string;
  business_photo?: string;
  passport_photo?: string;
}

interface EditClientDialogProps {
  client: Client;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClientUpdated: () => void;
  referees?: ClientReferee[];
  documents?: ClientDocument[];
  signedUrls?: SignedUrls;
}

export function EditClientDialog({ client, open, onOpenChange, onClientUpdated, referees: initialReferees = [], documents: initialDocuments = [], signedUrls = {} }: EditClientDialogProps) {
  const [formData, setFormData] = useState<Client>(client);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("details");
  const [loanOfficers, setLoanOfficers] = useState<LoanOfficer[]>([]);
  const { toast } = useToast();

  // Photos state
  const [photoFiles, setPhotoFiles] = useState<Record<string, { file: File; preview: string } | null>>({
    passport: null, id_front: null, id_back: null, business: null,
  });

  // Referees state
  const [referees, setReferees] = useState<ClientReferee[]>([]);

  // Documents state
  const [newDocuments, setNewDocuments] = useState<{ file: File; documentType: string }[]>([]);
  const [selectedDocType, setSelectedDocType] = useState("document");
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [currentDocuments, setCurrentDocuments] = useState<ClientDocument[]>([]);

  useEffect(() => {
    setFormData(client);
  }, [client]);

  useEffect(() => {
    if (open) {
      setReferees(initialReferees.length > 0 ? initialReferees.map(r => ({ ...r })) : [{ name: "", phone: "", relationship: "" }]);
      setCurrentDocuments([...initialDocuments]);
      setPhotoFiles({ passport: null, id_front: null, id_back: null, business: null });
      setNewDocuments([]);
      setActiveTab("details");
    }
  }, [open, initialReferees, initialDocuments]);

  useEffect(() => {
    if (!open) return;
    const fetchOfficers = async () => {
      try {
        const { data: roles } = await supabase.from('user_roles').select('user_id').eq('role', 'loan_officer');
        if (roles && roles.length > 0) {
          const { data: profiles } = await supabase.from('profiles').select('id, username, first_name, last_name').in('id', roles.map(r => r.user_id));
          setLoanOfficers((profiles || []) as LoanOfficer[]);
        }
      } catch (error) {
        console.error("Error fetching officers:", error);
      }
    };
    fetchOfficers();
  }, [open]);

  const handleInputChange = (field: keyof Client, value: string | number | null) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Photo handlers
  const handlePhotoSelect = async (key: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ variant: "destructive", title: "File too large", description: "Photo must be less than 10MB." });
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast({ variant: "destructive", title: "Invalid file", description: "Upload an image file." });
      return;
    }

    try {
      const compressedFile = await compressImageFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPhotoFiles(prev => ({ ...prev, [key]: { file: compressedFile, preview: ev.target?.result as string } }));
      };
      reader.readAsDataURL(compressedFile);
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Failed to process image." });
    }
  };

  const clearPhoto = (key: string) => {
    setPhotoFiles(prev => ({ ...prev, [key]: null }));
  };

  // Referee handlers
  const addReferee = () => {
    if (referees.length >= 4) return;
    setReferees(prev => [...prev, { name: "", phone: "", relationship: "" }]);
  };
  const removeReferee = (index: number) => setReferees(prev => prev.filter((_, i) => i !== index));
  const updateReferee = (index: number, field: string, value: string) => {
    setReferees(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r));
  };

  // Document handlers
  const handleDocFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setNewDocuments(prev => [...prev, ...files.map(f => ({ file: f, documentType: selectedDocType }))]);
    e.target.value = "";
  };
  const removeNewDoc = (index: number) => setNewDocuments(prev => prev.filter((_, i) => i !== index));

  const handleDeleteExistingDoc = async (docId: string, filePath: string) => {
    setDeletingDocId(docId);
    try {
      await supabase.storage.from("client-documents").remove([filePath]);
      const { error } = await supabase.from("client_documents").delete().eq("id", docId);
      if (error) throw error;
      setCurrentDocuments(prev => prev.filter(d => d.id !== docId));
      toast({ title: "Deleted", description: "Document removed." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setDeletingDocId(null);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // 1. Update client details
      const clientUpdates: Record<string, any> = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone: formData.phone,
        id_number: formData.id_number,
        gender: formData.gender || null,
        date_of_birth: formData.date_of_birth || null,
        address: formData.address || null,
        city: formData.city || null,
        region: formData.region || null,
        occupation: formData.occupation || null,
        employment_status: formData.employment_status || null,
        monthly_income: formData.monthly_income || null,
        status: formData.status,
        loan_officer_id: formData.loan_officer_id || null,
      };

      // 2. Upload photos
      const ts = Date.now();
      const sanitize = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, '_');
      if (photoFiles.passport?.file) {
        const path = `client_photos/${client.id}/${ts}_${sanitize(photoFiles.passport.file.name)}`;
        const { error } = await supabase.storage.from("client_photos").upload(path, photoFiles.passport.file);
        if (error) throw error;
        clientUpdates.photo_url = path;
      }
      if (photoFiles.id_front?.file) {
        const path = `id_photos/${client.id}/${ts}_${sanitize(photoFiles.id_front.file.name)}`;
        const { error } = await supabase.storage.from("client-id-photos").upload(path, photoFiles.id_front.file);
        if (error) throw error;
        clientUpdates.id_photo_front_url = path;
      }
      if (photoFiles.id_back?.file) {
        const path = `id_photos/${client.id}/${ts}_${sanitize(photoFiles.id_back.file.name)}`;
        const { error } = await supabase.storage.from("client-id-photos").upload(path, photoFiles.id_back.file);
        if (error) throw error;
        clientUpdates.id_photo_back_url = path;
      }
      if (photoFiles.business?.file) {
        const path = `business_photos/${client.id}/${ts}_${sanitize(photoFiles.business.file.name)}`;
        const { error } = await supabase.storage.from("client-business-photos").upload(path, photoFiles.business.file);
        if (error) throw error;
        clientUpdates.business_photo_url = path;
      }

      // Save client record
      const { error: updateError } = await supabase.from("clients").update(clientUpdates).eq("id", client.id);
      if (updateError) throw updateError;

      // 3. Save referees (delete all + re-insert)
      const organizationId = await getOrganizationId();
      await supabase.from("client_referees").delete().eq("client_id", client.id);
      const validReferees = referees.filter(r => r.name && r.phone && r.relationship);
      if (validReferees.length > 0) {
        const { error: refError } = await supabase.from("client_referees").insert(
          validReferees.map(r => ({ client_id: client.id, name: r.name, phone: r.phone, relationship: r.relationship, organization_id: organizationId }))
        );
        if (refError) throw refError;
      }

      // 4. Upload new documents
      if (newDocuments.length > 0) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");
        for (const doc of newDocuments) {
          const filePath = `documents/${client.id}/${Date.now()}_${doc.file.name}`;
          const { error: upErr } = await supabase.storage.from("client-documents").upload(filePath, doc.file);
          if (upErr) throw upErr;
          const { error: insErr } = await supabase.from("client_documents").insert({
            client_id: client.id, document_name: doc.file.name, file_path: filePath,
            document_type: doc.documentType, uploaded_by: user.id, organization_id: organizationId,
          });
          if (insErr) throw insErr;
        }
      }

      toast({ title: "Success", description: "Client updated successfully." });
      onClientUpdated();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error updating client:", error);
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to update client." });
    } finally {
      setLoading(false);
    }
  };

  const photoSlots = [
    { key: "passport", label: "Passport Photo", currentUrl: signedUrls.passport_photo },
    { key: "id_front", label: "National ID (Front)", currentUrl: signedUrls.id_photo_front },
    { key: "id_back", label: "National ID (Back)", currentUrl: signedUrls.id_photo_back },
    { key: "business", label: "Business Photo", currentUrl: signedUrls.business_photo },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Client — {client.first_name} {client.last_name}</DialogTitle>
          <DialogDescription>Update client information, photos, referees, and documents.</DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="photos">Photos</TabsTrigger>
            <TabsTrigger value="referees">Referees</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
          </TabsList>

          {/* DETAILS TAB */}
          <TabsContent value="details" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name *</Label>
                <Input value={formData.first_name} onChange={(e) => handleInputChange('first_name', e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Last Name *</Label>
                <Input value={formData.last_name} onChange={(e) => handleInputChange('last_name', e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Phone *</Label>
                <Input value={formData.phone} onChange={(e) => handleInputChange('phone', e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>ID Number *</Label>
                <Input value={formData.id_number} onChange={(e) => handleInputChange('id_number', e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Gender</Label>
                <Select value={formData.gender || ''} onValueChange={(v) => handleInputChange('gender', v || null)}>
                  <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date of Birth</Label>
                <Input type="date" value={formData.date_of_birth || ''} onChange={(e) => handleInputChange('date_of_birth', e.target.value || null)} />
              </div>
              <div className="space-y-2">
                <Label>Occupation</Label>
                <Input value={formData.occupation || ''} onChange={(e) => handleInputChange('occupation', e.target.value || null)} />
              </div>
              <div className="space-y-2">
                <Label>Employment Status</Label>
                <Select value={formData.employment_status || ''} onValueChange={(v) => handleInputChange('employment_status', v || null)}>
                  <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employed">Employed</SelectItem>
                    <SelectItem value="self-employed">Self-employed</SelectItem>
                    <SelectItem value="unemployed">Unemployed</SelectItem>
                    <SelectItem value="retired">Retired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Monthly Income (KES)</Label>
                <Input type="number" value={formData.monthly_income || ''} onChange={(e) => handleInputChange('monthly_income', e.target.value ? Number(e.target.value) : null)} />
              </div>
              <div className="space-y-2">
                <Label>Loan Officer</Label>
                <Select value={formData.loan_officer_id || ''} onValueChange={(v) => handleInputChange('loan_officer_id', v || null)}>
                  <SelectTrigger><SelectValue placeholder="Select loan officer" /></SelectTrigger>
                  <SelectContent>
                    {loanOfficers.length === 0 ? (
                      <SelectItem value="none" disabled>No officers found</SelectItem>
                    ) : (
                      loanOfficers.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.first_name && o.last_name ? `${o.first_name} ${o.last_name}` : o.username || o.id.substring(0, 8)}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>City</Label>
                <Input value={formData.city || ''} onChange={(e) => handleInputChange('city', e.target.value || null)} />
              </div>
              <div className="space-y-2">
                <Label>Region</Label>
                <Input value={formData.region || ''} onChange={(e) => handleInputChange('region', e.target.value || null)} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(v) => handleInputChange('status', v)}>
                  <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Textarea value={formData.address || ''} onChange={(e) => handleInputChange('address', e.target.value || null)} rows={3} />
            </div>
          </TabsContent>

          {/* PHOTOS TAB */}
          <TabsContent value="photos" className="mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {photoSlots.map(({ key, label, currentUrl }) => (
                <div key={key} className="space-y-2">
                  <Label>{label}</Label>
                  <div className="border border-dashed rounded-md p-3 space-y-2">
                    {(photoFiles[key]?.preview || currentUrl) && (
                      <div className="relative">
                        <img src={photoFiles[key]?.preview || currentUrl} alt={label} className="w-full h-32 object-cover rounded-md" />
                        {photoFiles[key]?.preview && (
                          <Button type="button" size="icon" variant="destructive" className="absolute top-1 right-1 h-6 w-6" onClick={() => clearPhoto(key)}>
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    )}
                    <input type="file" accept="image/*" className="sr-only" id={`edit-photo-${key}`} onChange={(e) => handlePhotoSelect(key, e)} />
                    <Label htmlFor={`edit-photo-${key}`} className="cursor-pointer">
                      <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                        <Camera className="h-4 w-4" />
                        {currentUrl || photoFiles[key]?.preview ? "Replace photo" : "Upload photo"}
                      </div>
                    </Label>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* REFEREES TAB */}
          <TabsContent value="referees" className="mt-4 space-y-4">
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
                    <Input value={referee.relationship} onChange={(e) => updateReferee(index, "relationship", e.target.value)} placeholder="e.g. Friend" />
                  </div>
                </div>
              </div>
            ))}
            {referees.length < 4 && (
              <Button type="button" variant="outline" onClick={addReferee} className="w-full">
                <Plus className="h-4 w-4 mr-2" /> Add Referee
              </Button>
            )}
          </TabsContent>

          {/* DOCUMENTS TAB */}
          <TabsContent value="documents" className="mt-4 space-y-4">
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
                    <Button size="sm" variant="ghost" disabled={deletingDocId === doc.id} onClick={() => handleDeleteExistingDoc(doc.id, doc.file_path)}>
                      {deletingDocId === doc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-3 border-t pt-4">
              <Label className="font-semibold">Add New Documents</Label>
              <div className="flex gap-2">
                <Select value={selectedDocType} onValueChange={setSelectedDocType}>
                  <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="document">General Document</SelectItem>
                    <SelectItem value="id_photo">ID Photo</SelectItem>
                    <SelectItem value="business_photo">Business Photo</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex-1">
                  <input type="file" multiple className="sr-only" id="edit-doc-upload" onChange={handleDocFileSelect} />
                  <Label htmlFor="edit-doc-upload" className="cursor-pointer">
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
          </TabsContent>
        </Tabs>

        <div className="flex justify-end space-x-2 pt-4 border-t">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save All Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
