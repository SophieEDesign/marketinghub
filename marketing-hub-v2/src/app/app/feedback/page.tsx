import { FeedbackClient } from "@/components/feedback/FeedbackClient";
import { getSessionUser } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function FeedbackPage() {
  const user = await getSessionUser();
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("feedback")
    .select("*")
    .order("created_at", { ascending: false });

  const isAdmin = user?.role === "admin";

  return (
    <FeedbackClient
      initial={data ?? []}
      isAdmin={isAdmin}
      currentUserName={user?.full_name ?? ""}
    />
  );
}
