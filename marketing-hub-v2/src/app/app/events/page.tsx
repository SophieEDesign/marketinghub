import { EventsClient } from "@/components/events/EventsClient";
import { listEvents } from "@/lib/data/repos";

export default async function EventsPage() {
  const events = await listEvents();
  return <EventsClient initialEvents={events} />;
}
