import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

const PUBLIC_COLS =
  "id, slug, title, start_date, end_date, location, maps_url, organizer, poster_url, description, lineup, facilities, socials, is_paid, price, payment_methods, registration_open";

export const listPublicEvents = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await publicClient()
    .from("events")
    .select(PUBLIC_COLS)
    .eq("is_published", true)
    .order("start_date", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const getPublicEvent = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1).max(100) }).parse(d))
  .handler(async ({ data }) => {
    const { data: row, error } = await publicClient()
      .from("events")
      .select(PUBLIC_COLS)
      .eq("slug", data.slug)
      .eq("is_published", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const getTicket = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ code: z.string().min(8).max(64) }).parse(d))
  .handler(async ({ data }) => {
    const { data: rows, error } = await publicClient().rpc("get_ticket", { _code: data.code });
    if (error) throw new Error(error.message);
    return rows?.[0] ?? null;
  });

export const publicEventsQuery = queryOptions({
  queryKey: ["public", "events"],
  queryFn: () => listPublicEvents(),
});
export const publicEventQuery = (slug: string) =>
  queryOptions({ queryKey: ["public", "event", slug], queryFn: () => getPublicEvent({ data: { slug } }) });
export const ticketQuery = (code: string) =>
  queryOptions({ queryKey: ["public", "ticket", code], queryFn: () => getTicket({ data: { code } }) });

export type PublicEvent = Awaited<ReturnType<typeof listPublicEvents>>[number];
