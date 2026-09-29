import { createFileRoute, Link } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Clock, CheckCircle, XCircle, ArrowLeft } from 'lucide-react';
import { SiteNav } from '@/components/landing/SiteNav';
import { SiteFooter } from '@/components/landing/SiteFooter';
import { format } from 'date-fns';

interface Certificate {
  id: string;
  certificateNumber: string;
  certificateUrl: string | null;
  status: 'pending' | 'processing' | 'generated' | 'failed';
  generatedAt: string | null;
  errorMessage: string | null;
  event: {
    title: string;
    slug: string;
    startDate: string;
    endDate: string;
  };
  registration: {
    name: string;
    checkedInAt: string | null;
  };
}

const getCertificates = createServerFn({ method: 'GET' })
  .validator((code: string) => code)
  .handler(async ({ data: ticketCode }): Promise<Certificate[]> => {
    try {
      const supabase = supabaseAdmin;

      // Get registration by ticket code
      const { data: registration, error: regError } = await supabase
        .from('event_registrations')
        .select('id, name, event_id, checked_in_at')
        .eq('ticket_code', ticketCode)
        .single();

      if (regError || !registration) {
        console.log('Registration not found:', regError);
        return [];
      }

      // Only show certificates if checked in
      if (!registration.checked_in_at) {
        console.log('Not checked in yet');
        return [];
      }

      // Get certificates for this registration
      const { data: certificates, error: certError } = await supabase
        .from('certificates')
        .select('id, certificate_number, certificate_url, status, generated_at, error_message, event_id')
        .eq('registration_id', registration.id);

      if (certError) {
        console.error('Certificate query error:', certError);
        return [];
      }

      if (!certificates || certificates.length === 0) {
        console.log('No certificates found');
        return [];
      }

      // Get event details separately
      const eventIds = [...new Set(certificates.map(c => c.event_id))];
      const { data: events } = await supabase
        .from('events')
        .select('id, title, slug, start_date, end_date')
        .in('id', eventIds);

      const eventMap = new Map(events?.map(e => [e.id, e]) || []);

      return certificates.map((cert: any) => {
        const event = eventMap.get(cert.event_id);
        return {
          id: cert.id,
          certificateNumber: cert.certificate_number,
          certificateUrl: cert.certificate_url,
          status: cert.status,
          generatedAt: cert.generated_at,
          errorMessage: cert.error_message,
          event: event ? {
            title: event.title,
            slug: event.slug,
            startDate: event.start_date,
            endDate: event.end_date,
          } : {
            title: 'Unknown Event',
            slug: '',
            startDate: '',
            endDate: '',
          },
          registration: {
            name: registration.name,
            checkedInAt: registration.checked_in_at,
          },
        };
      });
    } catch (error) {
      console.error('getCertificates error:', error);
      return [];
    }
  });

export const Route = createFileRoute('/sertifikat/$code')({
  component: CertificateDetailPage,
  loader: async ({ params }) => {
    return await getCertificates({ data: params.code });
  },
});

function CertificateDetailPage() {
  const certificates = Route.useLoaderData();
  const { code } = Route.useParams();

  if (!certificates || certificates.length === 0) {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteNav />
        <main className="flex-1 container mx-auto px-4 py-12">
          <div className="max-w-md mx-auto">
            <Card>
              <CardHeader>
                <CardTitle className="text-center">Sertifikat Belum Tersedia</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-center text-muted-foreground">
                  Sertifikat untuk tiket ini belum tersedia. Pastikan Anda sudah melakukan check-in di
                  event.
                </p>
                <div className="bg-blue-50 p-4 rounded-lg text-sm">
                  <p className="font-semibold mb-2">ℹ️ Cara mendapatkan sertifikat:</p>
                  <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                    <li>Hadiri event dan check-in dengan QR code</li>
                    <li>Tunggu beberapa menit untuk proses generate</li>
                    <li>Kembali ke halaman ini untuk download</li>
                  </ol>
                </div>
                <Link to="/tiket/$code" params={{ code }}>
                  <Button variant="outline" className="w-full">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Kembali ke Tiket
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SiteNav />
      <main className="flex-1 container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="flex items-center gap-2">
            <Link to="/sertifikat">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Kembali
              </Button>
            </Link>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Sertifikat Anda</CardTitle>
              <p className="text-sm text-muted-foreground">Kode Tiket: {code}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {certificates.map((cert) => (
                <Card key={cert.id} className="border-2">
                  <CardContent className="pt-6 space-y-3">
                    <div>
                      <h3 className="font-semibold text-lg">{cert.event.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {cert.event.startDate && cert.event.endDate ? (
                          <>
                            {format(new Date(cert.event.startDate), 'dd MMM yyyy')} -{' '}
                            {format(new Date(cert.event.endDate), 'dd MMM yyyy')}
                          </>
                        ) : (
                          'Tanggal tidak tersedia'
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm font-medium">Nama Peserta</p>
                      <p className="text-lg">{cert.registration.name}</p>
                    </div>

                    <div>
                      <p className="text-sm font-medium">Nomor Sertifikat</p>
                      <p className="font-mono">{cert.certificateNumber}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">Status:</p>
                      {cert.status === 'generated' && (
                        <Badge className="bg-green-500">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Siap Download
                        </Badge>
                      )}
                      {cert.status === 'pending' && (
                        <Badge className="bg-yellow-500">
                          <Clock className="w-3 h-3 mr-1" />
                          Menunggu Proses
                        </Badge>
                      )}
                      {cert.status === 'processing' && (
                        <Badge className="bg-blue-500">
                          <Clock className="w-3 h-3 mr-1" />
                          Sedang Diproses
                        </Badge>
                      )}
                      {cert.status === 'failed' && (
                        <Badge className="bg-red-500">
                          <XCircle className="w-3 h-3 mr-1" />
                          Gagal
                        </Badge>
                      )}
                    </div>

                    {cert.generatedAt && (
                      <p className="text-sm text-muted-foreground">
                        Dibuat: {format(new Date(cert.generatedAt), 'dd MMM yyyy HH:mm')}
                      </p>
                    )}

                    {cert.status === 'generated' && cert.certificateUrl && (
                      <Button 
                        className="w-full"
                        onClick={async () => {
                          try {
                            const response = await fetch(cert.certificateUrl!);
                            const blob = await response.blob();
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `Sertifikat-${cert.certificateNumber}.png`;
                            document.body.appendChild(a);
                            a.click();
                            window.URL.revokeObjectURL(url);
                            document.body.removeChild(a);
                          } catch (error) {
                            console.error('Download error:', error);
                            // Fallback: open in new tab
                            window.open(cert.certificateUrl, '_blank');
                          }
                        }}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download Sertifikat
                      </Button>
                    )}

                    {cert.status === 'pending' && (
                      <div className="bg-yellow-50 p-3 rounded text-sm">
                        Sertifikat Anda sedang dalam antrian. Biasanya proses ini memakan waktu 5-15 menit.
                        Silakan refresh halaman ini nanti.
                      </div>
                    )}

                    {cert.status === 'processing' && (
                      <div className="bg-blue-50 p-3 rounded text-sm">
                        Sertifikat sedang diproses. Harap tunggu beberapa saat dan refresh halaman.
                      </div>
                    )}

                    {cert.status === 'failed' && (
                      <div className="bg-red-50 p-3 rounded text-sm">
                        Maaf, terjadi kesalahan saat membuat sertifikat. Silakan hubungi panitia.
                        {cert.errorMessage && (
                          <p className="mt-2 text-xs text-muted-foreground">Error: {cert.errorMessage}</p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>

          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-muted-foreground">
              💡 <strong>Tips:</strong> Anda juga bisa mengakses sertifikat melalui halaman{' '}
              <Link to="/tiket/$code" params={{ code }} className="text-blue-600 hover:underline">
                tiket Anda
              </Link>
            </p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
