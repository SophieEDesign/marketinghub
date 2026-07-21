import { EventsClient } from "@/components/events/EventsClient";
import { getSessionUser } from "@/lib/auth/session";
import { getFieldOptionsMap } from "@/lib/data/data-admin";
import { listEvents } from "@/lib/data/repos";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const [events, user, fieldOptions] = await Promise.all([
    listEvents(),
    getSessionUser(),
    getFieldOptionsMap("events"),
  ]);
  return (
    <EventsClient
      initialEvents={events}
      currentUserId={user?.id ?? null}
      currentUserName={user?.full_name || user?.email || null}
      fieldOptions={fieldOptions}
    />
  );
}
