import { EventsClient } from "@/components/events/EventsClient";
import { ImportFromSupabaseButton } from "@/components/supabase/ImportFromSupabaseButton";
import { listEvents } from "@/lib/data/repos";
import { hasSupabaseConfig } from "@/lib/auth/config";

export default async function EventsPage() {
  const events = await listEvents();
  return (
    <div>
      {hasSupabaseConfig() ? (
        <div className="mb-4">
          <ImportFromSupabaseButton label="Refresh from Events table" />
        </div>
      ) : null}
      <EventsClient initialEvents={events} />
    </div>
  );
}
