import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { EventForm } from "@/components/admin/EventForm";
import { CertificateTemplateManager } from "@/components/admin/CertificateTemplateManager";
import { adminEventQuery } from "@/lib/events";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/admin/_auth/events/$id/edit")({
  head: () => ({ meta: [{ title: "Edit Event — Admin" }, { name: "robots", content: "noindex" }] }),
  component: EditEvent,
});

function EditEvent() {
  const { id } = Route.useParams();
  const { data, isLoading } = useQuery(adminEventQuery(id));
  if (isLoading) return <Loader2 className="size-5 animate-spin text-primary" />;
  if (!data) return <p className="text-sm text-muted-foreground">Event tidak ditemukan.</p>;
  return (
    <div className="mx-auto max-w-4xl">
      <h2 className="mb-6 font-display text-2xl font-bold">Edit event</h2>
      
      <Tabs defaultValue="details" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="details">Detail Event</TabsTrigger>
          <TabsTrigger value="certificate">Sertifikat</TabsTrigger>
        </TabsList>
        
        <TabsContent value="details" className="mt-6">
          <EventForm initial={data} />
        </TabsContent>
        
        <TabsContent value="certificate" className="mt-6">
          <CertificateTemplateManager eventId={id} eventSlug={data.slug} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
