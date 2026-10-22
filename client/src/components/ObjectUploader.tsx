import { useState, useId } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface ObjectUploaderProps {
  maxFileSize?: number;
  accept?: string;
  onGetUploadParameters: () => Promise<{
    method: "PUT";
    url: string;
  }>;
  onComplete?: (result: any) => void;
  buttonClassName?: string;
  children: ReactNode;
}

export function ObjectUploader({
  maxFileSize = 5242880,
  accept = "image/png,image/jpeg,image/gif,image/webp",
  onGetUploadParameters,
  onComplete,
  buttonClassName,
  children,
}: ObjectUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const inputId = useId();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (file.size > maxFileSize) {
      toast({
        title: "File too large",
        description: `Maximum file size is ${(maxFileSize / 1024 / 1024).toFixed(0)}MB`,
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const { method, url } = await onGetUploadParameters();
      
      const response = await fetch(url, {
        method,
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      await onComplete?.({
        successful: [{
          uploadURL: url.split("?")[0],
          type: file.type,
          name: file.name,
        }],
      });

      toast({
        title: "Upload successful",
        description: "Your file has been uploaded",
      });
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: "Failed to upload file. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div>
      <input
        type="file"
        id={inputId}
        className="hidden"
        onChange={handleFileSelect}
        accept={accept}
        disabled={uploading}
      />
      <Button
        type="button"
        onClick={() => document.getElementById(inputId)?.click()}
        className={buttonClassName}
        data-testid="button-upload"
        disabled={uploading}
      >
        {uploading ? "Uploading..." : children}
      </Button>
    </div>
  );
}
