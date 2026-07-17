import { EventsClient } from "@/components/events/EventsClient";
import { getSessionUser } from "@/lib/auth/session";
import { listEvents } from "@/lib/data/repos";

export default async function EventsPage() {
  const [events, user] = await Promise.all([listEvents(), getSessionUser()]);
  return (
    <EventsClient
      initialEvents={events}
      currentUserId={user?.id ?? null}
      currentUserName={user?.full_name || user?.email || null}
    />
  );
}
