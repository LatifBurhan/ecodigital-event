import { useState } from 'react';
import { Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface CertificateUploadProps {
  onFileSelect: (file: File | null) => void;
  existingUrl?: string;
}

export function CertificateUpload({ onFileSelect, existingUrl }: CertificateUploadProps) {
  const [preview, setPreview] = useState<string | null>(existingUrl || null);
  const [file, setFile] = useState<File | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0];
    
    if (!selectedFile) {
      return;
    }

    // Validate file type
    if (!selectedFile.type.startsWith('image/')) {
      alert('File harus berupa gambar (PNG/JPG)');
      return;
    }

    // Validate file size (max 5MB)
    if (selectedFile.size > 5 * 1024 * 1024) {
      alert('Ukuran file maksimal 5MB');
      return;
    }

    setFile(selectedFile);
    onFileSelect(selectedFile);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(selectedFile);
  }

  function handleRemove() {
    setFile(null);
    setPreview(null);
    onFileSelect(null);
    
    // Reset input
    const input = document.getElementById('certificate-template') as HTMLInputElement;
    if (input) {
      input.value = '';
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Template Sertifikat (Opsional)</CardTitle>
        <CardDescription>
          Upload template sertifikat untuk event ini. Format PNG/JPG, maksimal 5MB.
          Recommended: 1920×1080 px
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {preview ? (
          <div className="space-y-2">
            <Label>Preview Template</Label>
            <div className="relative border rounded-lg overflow-hidden bg-gray-50">
              <img 
                src={preview} 
                alt="Certificate template preview" 
                className="w-full h-auto"
              />
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="absolute top-2 right-2"
                onClick={handleRemove}
              >
                <X className="w-4 h-4 mr-1" />
                Hapus
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {file ? `File: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)` : 'Template existing'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="certificate-template">Upload Template</Label>
            <div className="flex gap-2">
              <Input
                id="certificate-template"
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                onChange={handleFileChange}
                className="flex-1"
              />
              <Button type="button" variant="outline" disabled>
                <Upload className="w-4 h-4 mr-2" />
                Pilih File
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Template sertifikat bisa diupload nanti setelah event dibuat.
              Posisi nama dan nomor sertifikat bisa diatur di halaman Edit Event.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
