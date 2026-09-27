import { createFileRoute } from "@tanstack/react-router";
import { EventForm } from "@/components/admin/EventForm";

export const Route = createFileRoute("/admin/_auth/events/new")({
  head: () => ({ meta: [{ title: "Buat Event — Admin" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <div className="mx-auto max-w-4xl">
      <h2 className="mb-6 font-display text-2xl font-bold">Buat event baru</h2>
      <EventForm />
    </div>
  ),
});
