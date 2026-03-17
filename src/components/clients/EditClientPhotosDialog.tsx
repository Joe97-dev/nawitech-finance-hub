import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Upload, X, Camera } from "lucide-react";

const compressImage = (file: File, maxWidth = 1200, quality = 0.8): Promise<File> => {
  return new Promise((resolve, reject) => {
    // If file is already small enough, skip compression
    if (file.size < 500 * 1024) {
      resolve(file);
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      let { width, height } = img;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(file); return; }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          resolve(new File([blob], file.name, { type: "image/jpeg" }));
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
};

interface EditClientPhotosDialogProps {
  clientId: string;
  clientName: string;
  currentPhotos: {
    photo_url: string | null;
    id_photo_front_url: string | null;
    id_photo_back_url: string | null;
    business_photo_url: string | null;
  };
  signedUrls: {
    passport_photo?: string;
    id_photo_front?: string;
    id_photo_back?: string;
    business_photo?: string;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPhotosUpdated: () => void;
}

interface PhotoSlot {
  label: string;
  key: "passport" | "id_front" | "id_back" | "business";
  file: File | null;
  preview: string | null;
  currentUrl?: string;
}

export function EditClientPhotosDialog({
  clientId, clientName, currentPhotos, signedUrls, open, onOpenChange, onPhotosUpdated
}: EditClientPhotosDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const [photos, setPhotos] = useState<PhotoSlot[]>([
    { label: "Passport Photo", key: "passport", file: null, preview: null, currentUrl: signedUrls.passport_photo },
    { label: "National ID (Front)", key: "id_front", file: null, preview: null, currentUrl: signedUrls.id_photo_front },
    { label: "National ID (Back)", key: "id_back", file: null, preview: null, currentUrl: signedUrls.id_photo_back },
    { label: "Business Photo", key: "business", file: null, preview: null, currentUrl: signedUrls.business_photo },
  ]);

  const handleFileSelect = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: "destructive", title: "File too large", description: "Photo must be less than 5MB." });
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast({ variant: "destructive", title: "Invalid file", description: "Please upload an image file." });
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      setPhotos(prev => prev.map((p, i) => i === index ? { ...p, file, preview: ev.target?.result as string } : p));
    };
    reader.readAsDataURL(file);
  };

  const clearFile = (index: number) => {
    setPhotos(prev => prev.map((p, i) => i === index ? { ...p, file: null, preview: null } : p));
  };

  const handleSubmit = async () => {
    const hasNewPhotos = photos.some(p => p.file);
    if (!hasNewPhotos) {
      onOpenChange(false);
      return;
    }

    setLoading(true);
    try {
      const updates: Record<string, string | null> = {};

      for (const photo of photos) {
        if (!photo.file) continue;
        const timestamp = Date.now();
        const sanitizedName = photo.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const fileName = `${timestamp}_${sanitizedName}`;

        if (photo.key === "passport") {
          const filePath = `client_photos/${clientId}/${fileName}`;
          const { error } = await supabase.storage.from("client_photos").upload(filePath, photo.file);
          if (error) throw error;
          updates.photo_url = filePath;
        } else if (photo.key === "id_front") {
          const filePath = `id_photos/${clientId}/${fileName}`;
          const { error } = await supabase.storage.from("client-id-photos").upload(filePath, photo.file);
          if (error) throw error;
          updates.id_photo_front_url = filePath;
        } else if (photo.key === "id_back") {
          const filePath = `id_photos/${clientId}/${fileName}`;
          const { error } = await supabase.storage.from("client-id-photos").upload(filePath, photo.file);
          if (error) throw error;
          updates.id_photo_back_url = filePath;
        } else if (photo.key === "business") {
          const filePath = `business_photos/${clientId}/${fileName}`;
          const { error } = await supabase.storage.from("client-business-photos").upload(filePath, photo.file);
          if (error) throw error;
          updates.business_photo_url = filePath;
        }
      }

      if (Object.keys(updates).length > 0) {
        const { error } = await supabase.from("clients").update(updates).eq("id", clientId);
        if (error) throw error;
      }

      toast({ title: "Success", description: "Photos updated successfully." });
      onPhotosUpdated();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error uploading photos:", error);
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to upload photos." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Photos — {clientName}</DialogTitle>
          <DialogDescription>Upload or replace client photos. Max 5MB each (JPG, PNG).</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {photos.map((photo, index) => (
            <div key={photo.key} className="space-y-2">
              <Label>{photo.label}</Label>
              <div className="border border-dashed rounded-md p-3 space-y-2">
                {(photo.preview || photo.currentUrl) && (
                  <div className="relative">
                    <img
                      src={photo.preview || photo.currentUrl}
                      alt={photo.label}
                      className="w-full h-32 object-cover rounded-md"
                    />
                    {photo.preview && (
                      <Button
                        type="button" size="icon" variant="destructive"
                        className="absolute top-1 right-1 h-6 w-6"
                        onClick={() => clearFile(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                )}
                <div>
                  <input
                    type="file" accept="image/*" className="sr-only"
                    id={`photo-${photo.key}`}
                    onChange={(e) => handleFileSelect(index, e)}
                  />
                  <Label htmlFor={`photo-${photo.key}`} className="cursor-pointer">
                    <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                      <Camera className="h-4 w-4" />
                      {photo.currentUrl || photo.preview ? "Replace photo" : "Upload photo"}
                    </div>
                  </Label>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Photos
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
