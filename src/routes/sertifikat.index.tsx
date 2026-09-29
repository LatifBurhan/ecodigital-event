import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Search } from 'lucide-react';
import { SiteNav } from '@/components/landing/SiteNav';
import { SiteFooter } from '@/components/landing/SiteFooter';

export const Route = createFileRoute('/sertifikat/')({
  component: CertificateSearchPage,
});

function CertificateSearchPage() {
  const navigate = useNavigate();
  const [ticketCode, setTicketCode] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (ticketCode.trim()) {
      navigate({ to: '/sertifikat/$code', params: { code: ticketCode.trim() } });
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SiteNav />
      <main className="flex-1 container mx-auto px-4 py-12">
        <div className="max-w-md mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="text-center">Cek Sertifikat</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ticket-code">Masukkan Kode Tiket Anda</Label>
                  <Input
                    id="ticket-code"
                    type="text"
                    placeholder="Contoh: abc123def456"
                    value={ticketCode}
                    onChange={(e) => setTicketCode(e.target.value)}
                    required
                  />
                  <p className="text-sm text-muted-foreground">
                    Kode tiket bisa ditemukan di email konfirmasi atau halaman tiket Anda
                  </p>
                </div>
                <Button type="submit" className="w-full">
                  <Search className="w-4 h-4 mr-2" />
                  Cari Sertifikat
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
