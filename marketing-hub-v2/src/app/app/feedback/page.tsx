import { FeedbackClient } from "@/components/feedback/FeedbackClient";
import { getSessionUser } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function FeedbackPage() {
  const user = await getSessionUser();
  const supabase = createServiceClient();
  const isAdmin = user?.role === "admin";

  let query = supabase
    .from("feedback")
    .select("*")
    .order("created_at", { ascending: false });

  if (!isAdmin && user) {
    query = query.eq("submitted_by", user.id);
  }

  const { data } = await query;

  return (
    <FeedbackClient
      initial={data ?? []}
      isAdmin={isAdmin}
      currentUserId={user?.id ?? ""}
      currentUserName={user?.full_name ?? ""}
    />
  );
}
