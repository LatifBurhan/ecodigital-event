import { useState, useRef, useEffect } from 'react';
import { useSupabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Upload, Save, Eye, Move } from 'lucide-react';

interface CertificateTemplateManagerProps {
  eventId: string;
  eventSlug: string;
}

interface TemplateConfig {
  id?: string;
  templateUrl?: string;
  namePositionX: number;
  namePositionY: number;
  nameFontSize: number;
  nameFontColor: string;
  nameFontFamily: string;
  nameTextAlign: 'left' | 'center' | 'right';
  certNumberPositionX: number;
  certNumberPositionY: number;
  certNumberFontSize: number;
  certNumberFontColor: string;
  certNumberFontFamily: string;
  certNumberTextAlign: 'left' | 'center' | 'right';
  templateWidth: number;
  templateHeight: number;
}

type DragMode = 'name' | 'cert-number' | null;

export function CertificateTemplateManager({ eventId, eventSlug }: CertificateTemplateManagerProps) {
  const supabase = useSupabase();
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [config, setConfig] = useState<TemplateConfig>({
    namePositionX: 500,
    namePositionY: 400,
    nameFontSize: 48,
    nameFontColor: '#000000',
    nameFontFamily: 'Arial',
    nameTextAlign: 'center',
    certNumberPositionX: 100,
    certNumberPositionY: 100,
    certNumberFontSize: 24,
    certNumberFontColor: '#000000',
    certNumberFontFamily: 'Arial',
    certNumberTextAlign: 'left',
    templateWidth: 1920,
    templateHeight: 1080,
  });

  // Load existing template
  useEffect(() => {
    loadExistingTemplate();
  }, [eventId]);

  // Draw preview
  useEffect(() => {
    if (previewUrl) {
      drawPreview();
    }
  }, [previewUrl, config]);

  async function loadExistingTemplate() {
    const { data, error } = await supabase
      .from('certificate_templates')
      .select('*')
      .eq('event_id', eventId)
      .single();

    if (data && !error) {
      setConfig({
        id: data.id,
        templateUrl: data.template_url,
        namePositionX: data.name_position_x,
        namePositionY: data.name_position_y,
        nameFontSize: data.name_font_size,
        nameFontColor: data.name_font_color,
        nameFontFamily: data.name_font_family,
        nameTextAlign: data.name_text_align,
        certNumberPositionX: data.cert_number_position_x,
        certNumberPositionY: data.cert_number_position_y,
        certNumberFontSize: data.cert_number_font_size,
        certNumberFontColor: data.cert_number_font_color,
        certNumberFontFamily: data.cert_number_font_family,
        certNumberTextAlign: data.cert_number_text_align,
        templateWidth: data.template_width,
        templateHeight: data.template_height,
      });
      setPreviewUrl(data.template_url);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar (PNG/JPG)');
      return;
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 5MB');
      return;
    }

    setTemplateFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        setConfig((prev) => ({
          ...prev,
          templateWidth: img.width,
          templateHeight: img.height,
        }));
        setPreviewUrl(e.target?.result as string);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  async function handleUploadTemplate() {
    if (!templateFile) {
      toast.error('Pilih file template terlebih dahulu');
      return;
    }

    setUploading(true);
    try {
      const fileName = `${eventId}/template.${templateFile.name.split('.').pop()}`;

      const { error: uploadError } = await supabase.storage
        .from('certificate-templates')
        .upload(fileName, templateFile, { upsert: true });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('certificate-templates').getPublicUrl(fileName);

      setConfig((prev) => ({ ...prev, templateUrl: publicUrl }));
      toast.success('Template berhasil diupload');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Gagal upload template');
    } finally {
      setUploading(false);
    }
  }

  async function handleSaveConfig() {
    if (!config.templateUrl) {
      toast.error('Upload template terlebih dahulu');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        event_id: eventId,
        template_url: config.templateUrl,
        name_position_x: config.namePositionX,
        name_position_y: config.namePositionY,
        name_font_size: config.nameFontSize,
        name_font_color: config.nameFontColor,
        name_font_family: config.nameFontFamily,
        name_text_align: config.nameTextAlign,
        cert_number_position_x: config.certNumberPositionX,
        cert_number_position_y: config.certNumberPositionY,
        cert_number_font_size: config.certNumberFontSize,
        cert_number_font_color: config.certNumberFontColor,
        cert_number_font_family: config.certNumberFontFamily,
        cert_number_text_align: config.certNumberTextAlign,
        template_width: config.templateWidth,
        template_height: config.templateHeight,
      };

      if (config.id) {
        const { error } = await supabase
          .from('certificate_templates')
          .update(payload)
          .eq('id', config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('certificate_templates').insert(payload);
        if (error) throw error;
      }

      toast.success('Konfigurasi sertifikat berhasil disimpan');
      await loadExistingTemplate();
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Gagal menyimpan konfigurasi');
    } finally {
      setSaving(false);
    }
  }

  function drawPreview() {
    const canvas = canvasRef.current;
    if (!canvas || !previewUrl) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // Set canvas size to match container
      const container = containerRef.current;
      if (!container) return;

      const maxWidth = container.clientWidth;
      const scale = maxWidth / img.width;
      const scaledHeight = img.height * scale;

      canvas.width = maxWidth;
      canvas.height = scaledHeight;

      // Draw template
      ctx.drawImage(img, 0, 0, maxWidth, scaledHeight);

      // Draw name position indicator
      const nameX = config.namePositionX * scale;
      const nameY = config.namePositionY * scale;
      
      ctx.fillStyle = config.nameFontColor;
      ctx.font = `bold ${config.nameFontSize * scale}px ${config.nameFontFamily}`;
      ctx.textAlign = config.nameTextAlign;
      const nameText = 'NAMA PESERTA';
      ctx.fillText(nameText, nameX, nameY);

      // Draw name crosshair
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(nameX - 20, nameY);
      ctx.lineTo(nameX + 20, nameY);
      ctx.moveTo(nameX, nameY - 20);
      ctx.lineTo(nameX, nameY + 20);
      ctx.stroke();

      // Draw cert number position indicator
      const certX = config.certNumberPositionX * scale;
      const certY = config.certNumberPositionY * scale;
      
      ctx.fillStyle = config.certNumberFontColor;
      ctx.font = `bold ${config.certNumberFontSize * scale}px ${config.certNumberFontFamily}`;
      ctx.textAlign = config.certNumberTextAlign;
      const certText = `${eventSlug.toUpperCase()}-001`;
      ctx.fillText(certText, certX, certY);

      // Draw cert number crosshair
      ctx.strokeStyle = '#0000ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(certX - 15, certY);
      ctx.lineTo(certX + 15, certY);
      ctx.moveTo(certX, certY - 15);
      ctx.lineTo(certX, certY + 15);
      ctx.stroke();
    };
    img.src = previewUrl;
  }

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!dragMode || !canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const container = containerRef.current;
    const scale = config.templateWidth / container.clientWidth;

    const x = (e.clientX - rect.left) * scale;
    const y = (e.clientY - rect.top) * scale;

    if (dragMode === 'name') {
      setConfig((prev) => ({
        ...prev,
        namePositionX: Math.round(x),
        namePositionY: Math.round(y),
      }));
    } else if (dragMode === 'cert-number') {
      setConfig((prev) => ({
        ...prev,
        certNumberPositionX: Math.round(x),
        certNumberPositionY: Math.round(y),
      }));
    }

    setDragMode(null);
    toast.success('Posisi berhasil diatur');
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Template Sertifikat</CardTitle>
          <CardDescription>
            Upload template sertifikat dan atur posisi nama serta nomor sertifikat
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* File Upload */}
          <div className="space-y-2">
            <Label htmlFor="template">Upload Template (PNG/JPG, Max 5MB)</Label>
            <div className="flex gap-2">
              <Input
                id="template"
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                onChange={handleFileSelect}
                disabled={uploading}
              />
              <Button onClick={handleUploadTemplate} disabled={!templateFile || uploading}>
                <Upload className="w-4 h-4 mr-2" />
                {uploading ? 'Uploading...' : 'Upload'}
              </Button>
            </div>
          </div>

          {/* Preview Canvas */}
          {previewUrl && (
            <div className="space-y-2">
              <Label>Preview & Posisi Teks</Label>
              <div
                ref={containerRef}
                className="border rounded-lg overflow-hidden bg-gray-50"
                style={{ cursor: dragMode ? 'crosshair' : 'default' }}
              >
                <canvas
                  ref={canvasRef}
                  onClick={handleCanvasClick}
                  className="w-full h-auto"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant={dragMode === 'name' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDragMode(dragMode === 'name' ? null : 'name')}
                >
                  <Move className="w-4 h-4 mr-2" />
                  Atur Posisi Nama {dragMode === 'name' && '(Klik di Canvas)'}
                </Button>
                <Button
                  variant={dragMode === 'cert-number' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDragMode(dragMode === 'cert-number' ? null : 'cert-number')}
                >
                  <Move className="w-4 h-4 mr-2" />
                  Atur Posisi Nomor {dragMode === 'cert-number' && '(Klik di Canvas)'}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                🔴 Merah = Posisi Nama | 🔵 Biru = Posisi Nomor Sertifikat
              </p>
            </div>
          )}

          {/* Configuration Forms */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Name Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Konfigurasi Nama</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Font Size</Label>
                    <Input
                      type="number"
                      value={config.nameFontSize}
                      onChange={(e) =>
                        setConfig((prev) => ({ ...prev, nameFontSize: parseInt(e.target.value) }))
                      }
                    />
                  </div>
                  <div>
                    <Label>Warna</Label>
                    <Input
                      type="color"
                      value={config.nameFontColor}
                      onChange={(e) =>
                        setConfig((prev) => ({ ...prev, nameFontColor: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <div>
                  <Label>Align</Label>
                  <select
                    className="w-full border rounded px-3 py-2"
                    value={config.nameTextAlign}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        nameTextAlign: e.target.value as 'left' | 'center' | 'right',
                      }))
                    }
                  >
                    <option value="left">Kiri</option>
                    <option value="center">Tengah</option>
                    <option value="right">Kanan</option>
                  </select>
                </div>
              </CardContent>
            </Card>

            {/* Cert Number Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Konfigurasi Nomor Sertifikat</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Font Size</Label>
                    <Input
                      type="number"
                      value={config.certNumberFontSize}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          certNumberFontSize: parseInt(e.target.value),
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label>Warna</Label>
                    <Input
                      type="color"
                      value={config.certNumberFontColor}
                      onChange={(e) =>
                        setConfig((prev) => ({ ...prev, certNumberFontColor: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <div>
                  <Label>Align</Label>
                  <select
                    className="w-full border rounded px-3 py-2"
                    value={config.certNumberTextAlign}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        certNumberTextAlign: e.target.value as 'left' | 'center' | 'right',
                      }))
                    }
                  >
                    <option value="left">Kiri</option>
                    <option value="center">Tengah</option>
                    <option value="right">Kanan</option>
                  </select>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Save Button */}
          <Button onClick={handleSaveConfig} disabled={saving || !config.templateUrl} className="w-full">
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Menyimpan...' : 'Simpan Konfigurasi'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
